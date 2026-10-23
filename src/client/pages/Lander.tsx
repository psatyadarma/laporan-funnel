import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, pixel, track, useBet, utm, variantFor, visitorId } from '../api';
import { LegalFooter } from './Legal';

export function Brand({ name }: { name: string }) {
  return <div className="brand"><span className="brand-dot" /> {name}</div>;
}

export function Lander() {
  const { bet: slug } = useParams();
  const { bet, error } = useBet(slug);
  const nav = useNavigate();
  const [variant] = useState(() => variantFor(slug ?? ''));
  const [contact, setContact] = useState('');
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!bet) return;
    utm();
    track(bet.slug, 'lp_view');
    pixel('ViewContent', { content_name: `${bet.slug}:lander:${variant}` });
  }, [bet, variant]);

  if (error) return <div className="page"><p>{error}</p></div>;
  if (!bet) return <div className="page" />;
  const hook = bet.hooks.find((h) => h.id === variant) ?? bet.hooks[0];

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!bet) return;
    setBusy(true); setFormError('');
    try {
      await api('/api/waitlist', { bet: bet.slug, variant, contact, utm: utm(), visitorId: visitorId() });
      pixel('Lead', { content_name: bet.slug });
      setJoined(true);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <Brand name={bet.brand} />
      <div style={{ marginTop: 36 }} className="fade">
        {hook.eyebrow && <span className="eyebrow">{hook.eyebrow}</span>}
        <h1>{hook.headline}</h1>
        <p className="lead">{hook.sub}</p>
        <ul className="checks">{(hook.bullets ?? bet.landerBullets).map((b) => <li key={b}>{b}</li>)}</ul>
      </div>
      <div className="spacer" />
      {bet.mode === 'live' ? (
        <div className="stack">
          <button className="btn" onClick={() => { track(bet.slug, 'cta_click'); nav(`/${bet.slug}/quiz`); }}>{hook.cta}</button>
          <p className="small muted" style={{ textAlign: 'center' }}>{hook.trust ?? bet.trustLine}</p>
        </div>
      ) : joined ? (
        <div className="card fade"><h3>✓ Terdaftar</h3><p className="muted" style={{ margin: 0 }}>{bet.waitlist.thanks}</p></div>
      ) : (
        <form className="card stack" onSubmit={join} onFocus={() => track(bet.slug, 'cta_click')}>
          <div><h3>{bet.waitlist.title}</h3><p className="muted small" style={{ margin: 0 }}>{bet.waitlist.sub}</p></div>
          <input className="field" value={contact} onChange={(e) => setContact(e.target.value)} placeholder={bet.waitlist.placeholder} required minLength={6} />
          <button className="btn" disabled={busy}>{busy ? 'Menyimpan…' : bet.waitlist.button}</button>
          {formError && <div className="error">{formError}</div>}
          <p className="small muted" style={{ margin: 0 }}>{hook.trust ?? bet.trustLine}</p>
        </form>
      )}
      <LegalFooter />
    </div>
  );
}
