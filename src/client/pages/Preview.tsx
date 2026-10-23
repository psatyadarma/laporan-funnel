import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Preview as PreviewData } from '../../shared/types';
import { api, fbCookies, ttCookies, pixel, rupiah, store, track, useBet, visitorId } from '../api';
import { Brand } from './Lander';
import { Link } from 'react-router-dom';
import { LegalFooter } from './Legal';

export function Preview() {
  const { bet: slug, sessionId } = useParams();
  const { bet } = useBet(slug);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(() => ({ name: store('buyer:name') ?? '', email: store('buyer:email') ?? '', mobile: store('buyer:mobile') ?? '' }));
  const [busy, setBusy] = useState(false);
  const paywallRef = useRef<HTMLDivElement>(null);
  const paywallSeen = useRef(false);

  useEffect(() => {
    api<{ preview: PreviewData }>(`/api/sessions/${sessionId}`).then((r) => setPreview(r.preview)).catch((e) => setError(e.message));
  }, [sessionId]);

  useEffect(() => {
    if (!bet || !preview) return;
    track(bet.slug, 'preview_view', { sessionId });
    const el = paywallRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !paywallSeen.current) {
        paywallSeen.current = true;
        track(bet.slug, 'paywall_view', { sessionId });
      }
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [bet, preview, sessionId]);

  if (error) return <div className="page"><p>{error}</p></div>;
  if (!bet || !preview) return <div className="page" />;

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!bet) return;
    setBusy(true); setError('');
    store('buyer:name', form.name); store('buyer:email', form.email); store('buyer:mobile', form.mobile);
    const eventId = `pur_${sessionId}_${Date.now().toString(36)}`;
    pixel('InitiateCheckout', { currency: 'IDR', value: bet.price, content_name: bet.slug });
    try {
      const r = await api<{ orderId: string; link: string }>('/api/orders', {
        sessionId, ...form, eventId, ...fbCookies(), ...ttCookies(), url: location.href, visitorId: visitorId(),
      });
      store(`order:${sessionId}`, r.orderId);
      location.href = r.link;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <Brand name={bet.brand} />
      <div className="result-hero fade">
        <span className="eyebrow">Hasil awalmu</span>
        <h1>{preview.title}</h1>
        <p>{preview.tagline}</p>
      </div>

      <div className="card">
        <h3>Kekuatan utamamu</h3>
        <ul className="checks" style={{ margin: '6px 0 0' }}>{preview.insights.map((i) => <li key={i}>{i}</li>)}</ul>
      </div>

      <div className="card" style={{ marginTop: 12, background: 'var(--soft)' }}>
        <p style={{ margin: 0, fontWeight: 700 }}>{preview.teaser}</p>
      </div>

      <div className="card locked" style={{ marginTop: 12 }}>
        <h3>Di laporan lengkapmu</h3>
        {preview.lockedSections.map((s) => (
          <div className="locked-row" key={s}>
            <div className="lock">🔒</div>
            <div>
              <div style={{ fontWeight: 600 }}>{s}</div>
              <div className="blur">Isi bagian ini disusun khusus dari jawabanmu dan situasimu saat ini.</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }} ref={paywallRef}>
        <h2>{bet.paywall.title}</h2>
        <p className="muted">{bet.paywall.sub}</p>
        <ul className="checks">{bet.paywall.includes.map((i) => <li key={i}>{i}</li>)}</ul>
        <div style={{ margin: '4px 0 16px' }}>
          <span className="price">{rupiah(bet.price)}</span>
          {bet.anchorPrice && <span className="strike">{rupiah(bet.anchorPrice)}</span>}
        </div>
        <form className="stack" onSubmit={pay}>
          <input className="field" placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoComplete="name" />
          <input className="field" placeholder={bet.emailDelivery ? 'Email (link laporan dikirim ke sini)' : 'Email'} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="email" />
          <input className="field" placeholder="Nomor WhatsApp" inputMode="tel" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} required autoComplete="tel" />
          <button className="btn" disabled={busy}>{busy ? 'Membuka pembayaran…' : bet.paywall.button}</button>
          {error && <div className="error">{error}</div>}
          <p className="small muted" style={{ margin: 0 }}>{bet.paywall.guarantee} Dengan membayar, kamu menyetujui <Link to="/syarat">Syarat &amp; Ketentuan</Link>.</p>
        </form>
      </div>
      <p className="small muted" style={{ marginTop: 16 }}>{bet.disclaimer}</p>
      <LegalFooter />
    </div>
  );
}
