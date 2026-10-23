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

/** First-touch UTM + ad click ids (fbclid, ttclid), kept for the session. */
export function utm(): Record<string, string> {
  try {
    const saved = sessionStorage.getItem('utm');
    if (saved) return JSON.parse(saved);
    const p = new URLSearchParams(location.search);
    const out: Record<string, string> = {};
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'ttclid']) {
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

// ---------- TikTok Pixel ----------
type Ttq = unknown[] & { [k: string]: any };
declare global { interface Window { ttq?: Ttq; TiktokAnalyticsObject?: string } }
let tiktokReady = '';

export function initTiktok(pixelId?: string) {
  if (!pixelId || tiktokReady) return;
  tiktokReady = pixelId;
  // TikTok's standard loader, unminified: queue calls until events.js arrives.
  window.TiktokAnalyticsObject = 'ttq';
  const ttq = (window.ttq = window.ttq || ([] as unknown as Ttq));
  ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent'];
  ttq.setAndDefer = (t: Ttq, e: string) => { t[e] = (...args: unknown[]) => { t.push([e, ...args]); }; };
  for (const m of ttq.methods) ttq.setAndDefer(ttq, m);
  ttq.instance = (t: string) => { const e = ttq._i[t] || []; for (const m of ttq.methods) ttq.setAndDefer(e, m); return e; };
  ttq.load = (e: string, n?: Record<string, unknown>) => {
    const r = 'https://analytics.tiktok.com/i18n/pixel/events.js';
    ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = r;
    ttq._t = ttq._t || {}; ttq._t[e] = +new Date();
    ttq._o = ttq._o || {}; ttq._o[e] = n || {};
    const s = document.createElement('script');
    s.async = true;
    s.src = `${r}?sdkid=${e}&lib=ttq`;
    document.head.appendChild(s);
  };
  ttq.load(pixelId);
  ttq.page();
}

/** Meta standard event → TikTok standard event. */
const TIKTOK_EVENTS: Record<string, string> = {
  ViewContent: 'ViewContent',
  CompleteRegistration: 'CompleteRegistration',
  InitiateCheckout: 'InitiateCheckout',
  Purchase: 'CompletePayment',
  Lead: 'SubmitForm',
};

/** Fires a standard event on every configured pixel (Meta + TikTok). eventId deduplicates with server events. */
export function pixel(event: string, params?: Record<string, unknown>, eventId?: string) {
  if (window.fbq && pixelReady) window.fbq('track', event, params ?? {}, eventId ? { eventID: eventId } : undefined);
  const tt = TIKTOK_EVENTS[event];
  if (window.ttq && tiktokReady && tt) {
    const p: Record<string, unknown> = { ...(params ?? {}) };
    if (p.value != null) { p.content_type = 'product'; p.content_id = `${String(p.content_name ?? 'laporan')}-report`; }
    window.ttq.track(tt, p, eventId ? { event_id: eventId } : undefined);
  }
}

/** TikTok click id + cookie, sent with the order so the server-side event matches the ad click. */
export function ttCookies(): { ttp?: string; ttclid?: string } {
  const get = (n: string) => document.cookie.split('; ').find((c) => c.startsWith(n + '='))?.split('=')[1];
  return { ttp: get('_ttp'), ttclid: utm().ttclid };
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
    if (cache[slug]) { applyTheme(cache[slug]); initPixel(cache[slug].metaPixelId); initTiktok(cache[slug].tiktokPixelId); setBet(cache[slug]); return; }
    api<PublicBetConfig>(`/api/bets/${slug}`)
      .then((b) => { cache[slug] = b; applyTheme(b); initPixel(b.metaPixelId); initTiktok(b.tiktokPixelId); setBet(b); })
      .catch(() => setError('Halaman tidak ditemukan.'));
  }, [slug]);
  return { bet, error };
}

export const rupiah = (n: number) => 'Rp' + n.toLocaleString('id-ID');
