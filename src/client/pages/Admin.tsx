import { useEffect, useState } from 'react';
import { api, rupiah, store } from '../api';
import type { ReportContent } from '../../shared/types';

interface Row { bet: string; variant: string; name: string; n: number; uniq: number; value: number }
interface Stats { days: number; bets: string[]; events: Row[]; waitlist: { bet: string; n: number }[]; reports: { status: string; n: number }[] }

const STEPS: [string, string][] = [
  ['lp_view', 'Lander'], ['cta_click', 'CTA tap'], ['waitlist_join', 'Waitlist'], ['quiz_start', 'Quiz start'], ['quiz_complete', 'Quiz done'],
  ['paywall_view', 'Paywall'], ['checkout_start', 'Checkout'], ['purchase', 'Paid'],
];

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10}%` : '–');

export function Admin() {
  const [key, setKey] = useState(() => store('adminKey') ?? '');
  const [days, setDays] = useState(14);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [test, setTest] = useState<{ busy?: boolean; error?: string; info?: string; content?: ReportContent }>({});

  async function load(k = key) {
    setError('');
    try {
      const s = await api<Stats>(`/api/admin/stats?key=${encodeURIComponent(k)}&days=${days}`);
      store('adminKey', k);
      setStats(s);
    } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { if (key) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [days]);

  const groups = new Map<string, Record<string, Row>>();
  for (const r of stats?.events ?? []) {
    const k = `${r.bet}|${r.variant}`;
    const g = groups.get(k) ?? {};
    g[r.name] = r;
    groups.set(k, g);
  }
  const uniq = (g: Record<string, Row>, n: string) => g[n]?.uniq ?? 0;
  const count = (g: Record<string, Row>, n: string) => g[n]?.n ?? 0;

  return (
    <div className="page wide">
      <div className="brand"><span className="brand-dot" /> Funnel stats</div>
      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <input className="field" type="password" placeholder="ADMIN_KEY" value={key} onChange={(e) => setKey(e.target.value)} />
        <select className="field" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {[1, 3, 7, 14, 30, 90].map((d) => <option key={d} value={d}>Last {d} days</option>)}
        </select>
        <button className="btn" style={{ gridColumn: '1 / -1' }}>Load</button>
      </form>
      {error && <div className="error">{error}</div>}
      {stats && (
        <>
          <div className="card table-wrap">
            <table>
              <thead>
                <tr><th>Bet</th><th>Hook</th>{STEPS.map(([, l]) => <th key={l}>{l}</th>)}<th>CTA tap %</th><th>Quiz done %</th><th>Paywall→paid %</th><th>Revenue</th></tr>
              </thead>
              <tbody>
                {[...groups.entries()].sort().map(([k, g]) => {
                  const [bet, variant] = k.split('|');
                  return (
                    <tr key={k}>
                      <td>{bet}</td><td>{variant}</td>
                      {STEPS.map(([n]) => <td key={n}>{n === 'purchase' ? count(g, n) : uniq(g, n)}</td>)}
                      <td>{pct(uniq(g, 'cta_click') || uniq(g, 'waitlist_join'), uniq(g, 'lp_view'))}</td>
                      <td>{pct(uniq(g, 'quiz_complete'), uniq(g, 'quiz_start'))}</td>
                      <td>{pct(count(g, 'purchase'), uniq(g, 'paywall_view'))}</td>
                      <td>{rupiah(g.purchase?.value ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="card" style={{ marginTop: 16 }}>
            <h3>Test AI report</h3>
            <p className="small muted">Writes an AI report for the most recent completed quiz, without payment. Nothing is saved. Takes up to a minute.</p>
            <button className="btn btn-ghost" disabled={test.busy} onClick={async () => {
              setTest({ busy: true });
              try {
                const r = await api<{ model: string; ms: number; profile: string; content: ReportContent }>(`/api/admin/test-report?key=${encodeURIComponent(key)}`, {});
                setTest({ content: r.content, info: `${r.model} · ${Math.round(r.ms / 1000)}s · profile ${r.profile}` });
              } catch (e) { setTest({ error: (e as Error).message }); }
            }}>{test.busy ? 'Writing report…' : 'Generate test report'}</button>
            {test.error && <div className="error">{test.error}</div>}
            {test.content && (
              <div className="report" style={{ marginTop: 16 }}>
                <p className="small muted">{test.info}</p>
                <h2>{test.content.title}</h2>
                <p className="lead">{test.content.subtitle}</p>
                <p>{test.content.intro}</p>
                {test.content.sections.map((s) => (
                  <section key={s.heading}><h3 style={{ marginTop: 18 }}>{s.heading}</h3>{s.paragraphs.map((p, i) => <p key={i}>{p}</p>)}{s.bullets && <ul>{s.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>}</section>
                ))}
                <p><em>{test.content.closing}</em></p>
              </div>
            )}
          </div>
          <p className="small muted" style={{ marginTop: 12 }}>
            Counts are unique visitors (paid = orders). Reports: {stats.reports.map((r) => `${r.status} ${r.n}`).join(', ') || 'none'}.
            Compare with Meta Ads Manager for CTR and spend. Hook test rule: best hook CTR ≥ 1% and CTA tap ≥ 30%, otherwise kill.
          </p>
        </>
      )}
    </div>
  );
}
