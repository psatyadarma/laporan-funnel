import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Answers } from '../../shared/types';
import { askedFor } from '../../shared/types';
import { api, pixel, track, useBet, utm, variantFor, visitorId } from '../api';
import { Brand } from './Lander';
import { Link } from 'react-router-dom';

export function Quiz() {
  const { bet: slug } = useParams();
  const { bet } = useBet(slug);
  const nav = useNavigate();
  const [variant] = useState(() => variantFor(slug ?? ''));
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [lineIdx, setLineIdx] = useState(0);
  const [error, setError] = useState('');
  const started = useRef(false);

  const questions = useMemo(
    () => (bet?.questions ?? []).filter((q) => askedFor(q, variant)),
    [bet, variant],
  );

  useEffect(() => {
    if (!bet || started.current) return;
    if (bet.mode !== 'live') { nav(`/${bet.slug}`, { replace: true }); return; }
    started.current = true;
    api<{ id: string }>('/api/sessions', { bet: bet.slug, variant, utm: utm(), visitorId: visitorId() })
      .then((r) => setSessionId(r.id))
      .catch((e) => setError(e.message));
  }, [bet, variant, nav]);

  useEffect(() => {
    if (!analyzing || !bet) return;
    const t = setInterval(() => setLineIdx((i) => Math.min(i + 1, bet.analyzingLines.length - 1)), 1700);
    return () => clearInterval(t);
  }, [analyzing, bet]);

  if (!bet) return <div className="page" />;
  const q = questions[step];

  async function finish(final: Answers) {
    if (!bet || !sessionId) { setError('Sesi belum siap, coba lagi.'); return; }
    setAnalyzing(true);
    try {
      const [res] = await Promise.all([
        api<{ preview: unknown }>(`/api/sessions/${sessionId}/complete`, { answers: final, visitorId: visitorId() }),
        new Promise((r) => setTimeout(r, 5200)), // builds anticipation; also hides API latency
      ]);
      void res;
      pixel('CompleteRegistration', { content_name: bet.slug });
      nav(`/${bet.slug}/hasil/${sessionId}`, { replace: true });
    } catch (e) {
      setAnalyzing(false);
      setError((e as Error).message);
    }
  }

  function answer(value: string | undefined) {
    if (!q) return;
    const next = { ...answers };
    if (value) next[q.id] = value; else delete next[q.id];
    setAnswers(next);
    // Per-question tracking: value = question number (1-based) within this variant's quiz.
    if (bet) track(bet.slug, 'quiz_q', { sessionId: sessionId ?? undefined, value: step + 1 });
    if (step + 1 < questions.length) setTimeout(() => setStep(step + 1), q.kind === 'choice' ? 180 : 0);
    else finish(next);
  }

  if (analyzing) {
    return (
      <div className="page">
        <Brand name={bet.brand} />
        <div className="center">
          <div className="spinner" />
          <p key={lineIdx} className="fade lead" style={{ margin: 0 }}>{bet.analyzingLines[lineIdx]}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="topbar">
        {step > 0 ? <button className="link-btn" onClick={() => setStep(step - 1)}>← Kembali</button> : <Brand name={bet.brand} />}
        <span className="small muted">{step + 1} / {questions.length}</span>
      </div>
      <div className="progress"><div style={{ width: `${((step + 1) / questions.length) * 100}%` }} /></div>
      {q && (
        <div key={q.id} className="fade">
          <h2 className="q-prompt">{q.prompt}</h2>
          {q.help && <p className="muted small">{q.help}</p>}
          {q.kind === 'choice' && q.options.map((o) => (
            <button key={o.id} className={`option ${answers[q.id] === o.id ? 'selected' : ''}`} onClick={() => answer(o.id)}>{o.label}</button>
          ))}
          {(q.kind === 'text' || q.kind === 'date') && (
            <TextStep
              kind={q.kind}
              initial={answers[q.id] ?? ''}
              placeholder={q.kind === 'text' ? q.placeholder : undefined}
              optional={!!q.optional}
              last={step + 1 === questions.length}
              onDone={answer}
            />
          )}
        </div>
      )}
      {error && <div className="error">{error}</div>}
      <div className="spacer" />
      {step === 0 && <p className="small muted" style={{ textAlign: 'center' }}>Dengan lanjut, kamu setuju jawabanmu dipakai untuk menyusun laporanmu sesuai <Link to="/privasi">Kebijakan Privasi</Link>.</p>}
    </div>
  );
}

function TextStep(p: { kind: 'text' | 'date'; initial: string; placeholder?: string; optional: boolean; last: boolean; onDone: (v: string | undefined) => void }) {
  const [v, setV] = useState(p.initial);
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); p.onDone(v.trim() || undefined); }}>
      <input className="field" type={p.kind === 'date' ? 'date' : 'text'} value={v} onChange={(e) => setV(e.target.value)} placeholder={p.placeholder} autoFocus maxLength={60} required={!p.optional} />
      <button className="btn" disabled={!p.optional && !v.trim()}>{p.last ? 'Lihat hasilku' : 'Lanjut'}</button>
      {p.optional && <button type="button" className="link-btn" onClick={() => p.onDone(undefined)}>Lewati</button>}
    </form>
  );
}
