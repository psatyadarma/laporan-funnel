import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ReportContent } from '../../shared/types';
import { api, track, useBet } from '../api';
import { Brand } from './Lander';

export function Report() {
  const { token } = useParams();
  const [slug, setSlug] = useState<string | undefined>();
  const { bet } = useBet(slug);
  const [content, setContent] = useState<ReportContent | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let stop = false;
    let n = 0;
    async function poll() {
      try {
        const r = await api<{ bet: string; status: string; content?: ReportContent }>(`/api/reports/${token}`);
        if (stop) return;
        setSlug(r.bet);
        if (r.status === 'ready' && r.content) { setContent(r.content); return; }
      } catch (e) {
        setError((e as Error).message);
        return;
      }
      n += 1;
      if (n < 100 && !stop) setTimeout(poll, 4000);
    }
    poll();
    return () => { stop = true; };
  }, [token]);

  useEffect(() => { if (bet && content) track(bet.slug, 'report_view'); }, [bet, content]);

  if (error) return <div className="page"><p>Laporan tidak ditemukan.</p></div>;
  if (!content || !bet) {
    return (
      <div className="page">
        {bet && <Brand name={bet.brand} />}
        <div className="center">
          <div className="spinner" />
          <h2>Laporanmu sedang disusun</h2>
          <p className="muted">Biasanya 1–2 menit. Halaman ini akan terbuka otomatis. Simpan link halaman ini untuk membukanya lagi kapan saja.</p>
        </div>
      </div>
    );
  }

  async function shareCard() {
    if (!bet || !content) return;
    track(bet.slug, 'share_click');
    const blob = await drawCard(content.title, content.subtitle, bet.brand, location.host, getComputedStyle(document.documentElement));
    const file = new File([blob], 'kartu-hasil.png', { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: bet.brand }).catch(() => {});
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'kartu-hasil.png';
      a.click();
    }
  }

  function copyLink() {
    navigator.clipboard?.writeText(location.href).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  return (
    <div className="page report">
      <Brand name={bet.brand} />
      <div className="result-hero">
        <span className="eyebrow">Laporan lengkap</span>
        <h1>{content.title}</h1>
        <p>{content.subtitle}</p>
      </div>
      <div className="toolbar no-print">
        <button className="btn" onClick={() => window.print()}>Simpan PDF</button>
        <button className="btn btn-ghost" onClick={shareCard}>Bagikan kartu</button>
      </div>
      <button className="link-btn no-print" onClick={copyLink}>{copied ? '✓ Link tersalin' : 'Salin link laporan ini (simpan agar bisa dibuka lagi)'}</button>
      <p className="lead" style={{ marginTop: 18 }}>{content.intro}</p>
      {content.sections.map((s, si) => (
        <section key={si}>
          {s.heading && <h2>{s.heading}</h2>}
          {s.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          {s.bullets && s.bullets.length > 0 && <ul>{s.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>}
        </section>
      ))}
      <div className="card" style={{ marginTop: 24, background: 'var(--soft)' }}><p style={{ margin: 0 }}>{content.closing}</p></div>
      <p className="small muted" style={{ marginTop: 18 }}>{content.disclaimer}</p>
    </div>
  );
}

/** 1080x1920 story card drawn on a canvas. */
async function drawCard(title: string, subtitle: string, brand: string, host: string, css: CSSStyleDeclaration): Promise<Blob> {
  const W = 1080, H = 1920;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const v = (n: string) => css.getPropertyValue(n).trim() || '#1f6f50';
  const font = v('--font');
  await document.fonts?.ready;
  g.fillStyle = v('--accent'); g.fillRect(0, 0, W, H);
  g.fillStyle = v('--accent-ink');
  g.font = `700 44px ${font}`; g.fillText(brand.toUpperCase(), 96, 200);
  g.font = `600 52px ${font}`; g.globalAlpha = 0.8; g.fillText('Profilku:', 96, 720); g.globalAlpha = 1;
  const wrap = (text: string, size: number, weight: number, y: number, lh: number) => {
    g.font = `${weight} ${size}px ${font}`;
    const words = text.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (g.measureText(test).width > W - 192 && line) { g.fillText(line, 96, y); y += lh; line = w; } else line = test;
    }
    if (line) g.fillText(line, 96, y);
    return y + lh;
  };
  const shortTitle = title.includes(': ') ? title.split(': ').slice(1).join(': ') : title;
  let y = wrap(shortTitle, 112, 800, 860, 124);
  g.globalAlpha = 0.9;
  y = wrap(subtitle, 52, 500, y + 40, 72);
  g.globalAlpha = 0.85;
  g.font = `600 44px ${font}`; g.fillText(`Cek profilmu di ${host}`, 96, H - 180);
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
}
