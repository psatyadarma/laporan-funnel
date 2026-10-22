import { useEffect, useState } from 'react';
import type { PublicBetConfig } from '../shared/types';

// ---------- storage helpers (never throw: private mode, in-app browsers) ----------
export function store(key: string, value?: string): string | null {
  try {
    if (value !== undefined) localStorage.setItem(key, value);
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function randomId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function visitorId(): string {
  return store('vid') ?? store('vid', randomId()) ?? 'anon';
}

/** First-touch UTM + fbclid, kept for the session. */
export function utm(): Record<string, string> {
  try {
    const saved = sessionStorage.getItem('utm');
    if (saved) return JSON.parse(saved);
    const p = new URLSearchParams(location.search);
    const out: Record<string, string> = {};
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid']) {
      const v = p.get(k);
      if (v) out[k] = v;
    }
    sessionStorage.setItem('utm', JSON.stringify(out));
    return out;
  } catch {
    return {};
  }
}

/** Hook variant from ?h=, remembered per bet so the quiz and checkout keep it. */
export function variantFor(bet: string): string {
  const fromUrl = new URLSearchParams(location.search).get('h');
  if (fromUrl) store(`variant:${bet}`, fromUrl.slice(0, 20));
  return store(`variant:${bet}`) ?? '1';
}

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined ? undefined : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Gagal (${res.status})`);
  return json as T;
}

export function track(bet: string, name: string, extra: { sessionId?: string; value?: number } = {}) {
  const body = JSON.stringify({ bet, name, variant: store(`variant:${bet}`) ?? '1', visitorId: visitorId(), ...extra });
  try {
    if (navigator.sendBeacon?.(`/api/events`, new Blob([body], { type: 'application/json' }))) return;
  } catch { /* fall through */ }
  fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
}

// ---------- Meta Pixel ----------
type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
declare global { interface Window { fbq?: Fbq; _fbq?: Fbq } }
let pixelReady = '';

export function initPixel(pixelId?: string) {
  if (!pixelId || pixelReady === pixelId) return;
  pixelReady = pixelId;
  if (!window.fbq) {
    const f: Fbq = function (...args: unknown[]) {
      if (f.callMethod) f.callMethod(...args);
      else (f.queue ??= []).push(args);
    } as Fbq;
    f.push = f; f.loaded = true; f.version = '2.0'; f.queue = [];
    window.fbq = f; window._fbq = f;
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(s);
  }
  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');
}

export function pixel(event: string, params?: Record<string, unknown>, eventId?: string) {
  if (!window.fbq || !pixelReady) return;
  window.fbq('track', event, params ?? {}, eventId ? { eventID: eventId } : undefined);
}

export function fbCookies(): { fbp?: string; fbc?: string } {
  const get = (n: string) => document.cookie.split('; ').find((c) => c.startsWith(n + '='))?.split('=')[1];
  let fbc = get('_fbc');
  const fbclid = utm().fbclid;
  if (!fbc && fbclid) fbc = `fb.1.${Date.now()}.${fbclid}`;
  return { fbp: get('_fbp'), fbc };
}

// ---------- bet config ----------
const cache: Record<string, PublicBetConfig> = {};

export function applyTheme(b: PublicBetConfig) {
  const r = document.documentElement.style;
  r.setProperty('--bg', b.theme.bg);
  r.setProperty('--surface', b.theme.surface);
  r.setProperty('--ink', b.theme.ink);
  r.setProperty('--muted', b.theme.muted);
  r.setProperty('--accent', b.theme.accent);
  r.setProperty('--accent-ink', b.theme.accentInk);
  r.setProperty('--font', `'${b.theme.font}', system-ui, sans-serif`);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', b.theme.bg);
  document.title = b.brand;
}

export function useBet(slug: string | undefined) {
  const [bet, setBet] = useState<PublicBetConfig | null>(slug ? cache[slug] ?? null : null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!slug) return;
    if (cache[slug]) { applyTheme(cache[slug]); initPixel(cache[slug].metaPixelId); setBet(cache[slug]); return; }
    api<PublicBetConfig>(`/api/bets/${slug}`)
      .then((b) => { cache[slug] = b; applyTheme(b); initPixel(b.metaPixelId); setBet(b); })
      .catch(() => setError('Halaman tidak ditemukan.'));
  }, [slug]);
  return { bet, error };
}

export const rupiah = (n: number) => 'Rp' + n.toLocaleString('id-ID');
