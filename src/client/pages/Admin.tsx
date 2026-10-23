import { useEffect, useState } from 'react';
import { api, rupiah, store } from '../api';
import type { PublicBetConfig, ReportContent } from '../../shared/types';
import { askedFor } from '../../shared/types';

interface Row { bet: string; variant: string; name: string; n: number; uniq: number; value: number }
interface QRow { bet: string; variant: string; q: number; uniq: number }
interface Stats { days: number; bets: string[]; events: Row[]; waitlist: { bet: string; n: number }[]; reports: { status: string; n: number }[]; questions: QRow[] }

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
  const [configs, setConfigs] = useState<Record<string, PublicBetConfig>>({});

  useEffect(() => {
    for (const slug of stats?.bets ?? []) {
      if (configs[slug]) continue;
      api<PublicBetConfig>(`/api/bets/${slug}`).then((b) => setConfigs((c) => ({ ...c, [slug]: b }))).catch(() => {});
    }
  }, [stats, configs]);

  async function load(k = key) {
    setError('');
    try {
      const s = await api<Stats>(`/api/admin/stats?key=${encodeURIComponent(k)}&days=${days}`);
      store('adminKey', k);
      setStats(s);
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg === 'unauthorized' ? 'Wrong password, or ADMIN_KEY is missing in Cloudflare (Settings → Variables and Secrets).' : msg);
    }
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
          <QuizDropoff stats={stats} configs={configs} groups={groups} />
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
                {test.content.sections.map((s, si) => (
                  <section key={si}>{s.heading && <h3 style={{ marginTop: 18 }}>{s.heading}</h3>}{s.paragraphs.map((p, i) => <p key={i}>{p}</p>)}{s.bullets && <ul>{s.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>}</section>
                ))}
                <p><em>{test.content.closing}</em></p>
              </div>
            )}
          </div>
          <TestEmail adminKey={key} />
          <p className="small muted" style={{ marginTop: 12 }}>
            Counts are unique visitors (paid = orders). Reports: {stats.reports.map((r) => `${r.status} ${r.n}`).join(', ') || 'none'}.
            Compare with Meta Ads Manager for CTR and spend. Hook test rule: best hook CTR ≥ 1% and CTA tap ≥ 30%, otherwise kill.
          </p>
        </>
      )}
    </div>
  );
}

/** Per-question drop-off: how many quiz starters answered each question. The biggest drop is highlighted. */
function QuizDropoff({ stats, configs, groups }: { stats: Stats; configs: Record<string, PublicBetConfig>; groups: Map<string, Record<string, Row>> }) {
  const byGroup = new Map<string, QRow[]>();
  for (const r of stats.questions ?? []) {
    const k = `${r.bet}|${r.variant}`;
    byGroup.set(k, [...(byGroup.get(k) ?? []), r]);
  }
  if (!byGroup.size) return null;
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>Quiz drop-off by question</h3>
      <p className="small muted">Share of quiz starters who answered each question. The biggest drop is marked; trim or rewrite that question first.</p>
      {[...byGroup.entries()].sort().map(([k, rows]) => {
        const [bet, variant] = k.split('|');
        const starters = groups.get(k)?.quiz_start?.uniq ?? rows[0]?.uniq ?? 0;
        const qs = (configs[bet]?.questions ?? []).filter((q) => askedFor(q, variant));
        const counts = rows.map((r) => r.uniq);
        let worst = -1, worstDrop = 0;
        counts.forEach((n, i) => { const prev = i === 0 ? starters : counts[i - 1]; const d = prev - n; if (d > worstDrop) { worstDrop = d; worst = i; } });
        return (
          <div key={k} className="table-wrap" style={{ marginTop: 12 }}>
            <p className="small" style={{ margin: '0 0 6px', fontWeight: 700 }}>{bet} · hook {variant} · {starters} starters</p>
            <table>
              <thead><tr><th>#</th><th>Question</th><th>Answered</th><th>% of starters</th><th>Lost here</th></tr></thead>
              <tbody>
                {rows.map((r, i) => {
                  const prev = i === 0 ? starters : rows[i - 1].uniq;
                  return (
                    <tr key={r.q} style={i === worst ? { background: 'var(--soft)', fontWeight: 700 } : undefined}>
                      <td>{r.q}</td>
                      <td style={{ textAlign: 'left', whiteSpace: 'normal', minWidth: 220 }}>{qs[r.q - 1]?.prompt ?? '–'}</td>
                      <td>{r.uniq}</td>
                      <td>{pct(r.uniq, starters)}</td>
                      <td>{Math.max(0, prev - r.uniq)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

/** Sends a sample "report ready" email to check the Resend setup. */
function TestEmail({ adminKey }: { adminKey: string }) {
  const [to, setTo] = useState('');
  const [state, setState] = useState<{ busy?: boolean; msg?: string; error?: string }>({});
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>Test email</h3>
      <p className="small muted">Sends a sample "your report is ready" email. Leave empty to send to the contact email on the legal pages.</p>
      <form className="stack" onSubmit={async (e) => {
        e.preventDefault();
        setState({ busy: true });
        try {
          const r = await api<{ to: string }>(`/api/admin/test-email?key=${encodeURIComponent(adminKey)}`, { to: to.trim() || undefined });
          setState({ msg: `Sent to ${r.to}. Check the inbox and the spam folder.` });
        } catch (err) { setState({ error: (err as Error).message }); }
      }}>
        <input className="field" type="email" placeholder="you@example.com (optional)" value={to} onChange={(e) => setTo(e.target.value)} />
        <button className="btn btn-ghost" disabled={state.busy}>{state.busy ? 'Sending…' : 'Send test email'}</button>
      </form>
      {state.msg && <p className="small" style={{ marginTop: 8 }}>{state.msg}</p>}
      {state.error && <div className="error">{state.error}</div>}
    </div>
  );
}
