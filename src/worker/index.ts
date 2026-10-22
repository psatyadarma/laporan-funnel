import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from './env';
import { pixelIdFor } from './env';
import { getBet, BETS } from '../bets';
import { askedFor, toPublic } from '../shared/types';
import type { Answers, ReportContent } from '../shared/types';
import { getProvider, verifyMidtransSignature } from './payments';
import { generateAiReport } from './ai';
import { sendPurchase } from './capi';

const app = new Hono<{ Bindings: Env }>();

const EVENT_NAMES = new Set([
  'lp_view', 'cta_click', 'waitlist_join', 'quiz_start', 'quiz_complete', 'preview_view',
  'paywall_view', 'checkout_start', 'purchase', 'report_view', 'share_click', 'quiz_q',
]);

const now = () => Date.now();
function randomId(bytes = 12): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
/** Public origin: PUBLIC_BASE_URL if set, otherwise the URL this request came in on. */
const baseUrl = (c: Context<{ Bindings: Env }>) => (c.env.PUBLIC_BASE_URL || new URL(c.req.url).origin).replace(/\/$/, '');
const clip = (v: unknown, n = 200) => (typeof v === 'string' ? v.slice(0, n) : undefined);

async function logEvent(env: Env, e: { bet: string; variant?: string | null; name: string; sessionId?: string | null; visitorId?: string | null; value?: number | null }) {
  await env.DB.prepare('INSERT INTO events (bet, variant, name, session_id, visitor_id, value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(e.bet, e.variant ?? null, e.name, e.sessionId ?? null, e.visitorId ?? null, e.value ?? null, now())
    .run();
}

// ---------- Health check: shows only WHETHER settings exist, never their values ----------
app.get('/api/health', (c) => {
  const set = (v?: string) => (v && v.trim() ? 'set' : 'missing');
  return c.json({
    ok: true,
    settings: {
      ADMIN_KEY: set(c.env.ADMIN_KEY),
      AI_API_KEY: set(c.env.AI_API_KEY),
      PAYMENT_PROVIDER: c.env.PAYMENT_PROVIDER,
      MIDTRANS_SERVER_KEY: set(c.env.MIDTRANS_SERVER_KEY),
      MIDTRANS_PRODUCTION: c.env.MIDTRANS_PRODUCTION ?? 'false',
      MAYAR_API_KEY: set(c.env.MAYAR_API_KEY),
      META_PIXEL_IDS: set(c.env.META_PIXEL_IDS),
      META_CAPI_TOKEN: set(c.env.META_CAPI_TOKEN),
      AI_MODEL: c.env.AI_MODEL,
    },
  });
});

// ---------- Public config ----------
app.get('/api/bets/:slug', (c) => {
  const bet = getBet(c.req.param('slug'));
  if (!bet) return c.json({ error: 'not found' }, 404);
  return c.json({ ...toPublic(bet), metaPixelId: pixelIdFor(c.env, bet.slug) });
});

// ---------- Analytics events ----------
app.post('/api/events', async (c) => {
  const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
  const bet = clip(b.bet, 40);
  const name = clip(b.name, 40);
  if (!bet || !getBet(bet) || !name || !EVENT_NAMES.has(name) || name === 'purchase') return c.json({ ok: false }, 400);
  // Only quiz_q carries a value (the question number); purchase values are logged server-side.
  const qn = name === 'quiz_q' ? Math.trunc(Number(b.value)) : NaN;
  if (name === 'quiz_q' && !(qn >= 1 && qn <= 100)) return c.json({ ok: false }, 400);
  await logEvent(c.env, { bet, variant: clip(b.variant, 20), name, sessionId: clip(b.sessionId, 40), visitorId: clip(b.visitorId, 40), value: Number.isNaN(qn) ? null : qn });
  return c.json({ ok: true });
});

// ---------- Waitlist ----------
app.post('/api/waitlist', async (c) => {
  const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
  const bet = clip(b.bet, 40);
  const contact = clip(b.contact, 120)?.trim();
  if (!bet || !getBet(bet) || !contact || contact.length < 6) return c.json({ error: 'Isi nomor WhatsApp atau email yang valid.' }, 400);
  const variant = clip(b.variant, 20) ?? null;
  await c.env.DB.prepare('INSERT INTO waitlist (id, bet, variant, contact, utm_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(randomId(), bet, variant, contact, JSON.stringify(b.utm ?? {}).slice(0, 1000), now()).run();
  await logEvent(c.env, { bet, variant, name: 'waitlist_join', visitorId: clip(b.visitorId, 40) });
  return c.json({ ok: true });
});

// ---------- Quiz sessions ----------
app.post('/api/sessions', async (c) => {
  const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
  const bet = getBet(clip(b.bet, 40) ?? '');
  if (!bet || bet.mode !== 'live') return c.json({ error: 'bet not live' }, 400);
  const id = randomId();
  const variant = clip(b.variant, 20) ?? null;
  await c.env.DB.prepare('INSERT INTO sessions (id, bet, variant, utm_json, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, bet.slug, variant, JSON.stringify(b.utm ?? {}).slice(0, 1000), now()).run();
  await logEvent(c.env, { bet: bet.slug, variant, name: 'quiz_start', sessionId: id, visitorId: clip(b.visitorId, 40) });
  return c.json({ id });
});

app.post('/api/sessions/:id/complete', async (c) => {
  const id = c.req.param('id');
  const s = await c.env.DB.prepare('SELECT * FROM sessions WHERE id = ?').bind(id).first<{ bet: string; variant: string | null }>();
  if (!s) return c.json({ error: 'session not found' }, 404);
  const bet = getBet(s.bet)!;
  const b = await c.req.json<{ answers?: Answers; visitorId?: string }>().catch(() => ({} as { answers?: Answers; visitorId?: string }));
  const answers: Answers = {};
  for (const q of bet.questions) {
    const v = b.answers?.[q.id];
    if (!askedFor(q, s.variant)) continue;
    if (q.kind === 'choice') {
      if (!q.options.some((o) => o.id === v)) return c.json({ error: `Pertanyaan belum dijawab: ${q.prompt}` }, 400);
      answers[q.id] = v as string;
    } else if (typeof v === 'string' && v.trim()) {
      answers[q.id] = v.trim().slice(0, 60);
    } else if (!q.optional) {
      return c.json({ error: `Pertanyaan belum dijawab: ${q.prompt}` }, 400);
    }
  }
  const result = bet.score(answers, s.variant ?? undefined);
  const preview = bet.preview(result, answers);
  await c.env.DB.prepare('UPDATE sessions SET answers_json = ?, result_json = ? WHERE id = ?')
    .bind(JSON.stringify(answers), JSON.stringify({ result, preview }), id).run();
  await logEvent(c.env, { bet: bet.slug, variant: s.variant, name: 'quiz_complete', sessionId: id, visitorId: clip(b.visitorId, 40) });
  return c.json({ preview });
});

app.get('/api/sessions/:id', async (c) => {
  const s = await c.env.DB.prepare('SELECT bet, variant, result_json FROM sessions WHERE id = ?').bind(c.req.param('id')).first<{ bet: string; variant: string | null; result_json: string | null }>();
  if (!s?.result_json) return c.json({ error: 'not found' }, 404);
  return c.json({ bet: s.bet, variant: s.variant, preview: JSON.parse(s.result_json).preview });
});

// ---------- Orders & payment ----------
app.post('/api/orders', async (c) => {
  const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
  const sessionId = clip(b.sessionId, 40) ?? '';
  const s = await c.env.DB.prepare('SELECT id, bet, variant, result_json FROM sessions WHERE id = ?').bind(sessionId).first<{ id: string; bet: string; variant: string | null; result_json: string | null }>();
  if (!s?.result_json) return c.json({ error: 'Selesaikan tes dulu.' }, 400);
  const bet = getBet(s.bet)!;
  const name = clip(b.name, 80)?.trim() ?? '';
  const email = clip(b.email, 120)?.trim() ?? '';
  const mobile = clip(b.mobile, 30)?.trim() ?? '';
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || mobile.replace(/\D/g, '').length < 9) {
    return c.json({ error: 'Isi nama, email, dan nomor WhatsApp yang valid.' }, 400);
  }
  const orderId = randomId();
  const eventId = clip(b.eventId, 60) ?? randomId();
  const client = JSON.stringify({
    ip: c.req.header('cf-connecting-ip'),
    ua: c.req.header('user-agent')?.slice(0, 300),
    fbp: clip(b.fbp, 100),
    fbc: clip(b.fbc, 200),
    url: clip(b.url, 300),
  });
  let provider;
  try { provider = getProvider(c.env); } catch (err) {
    console.error(err);
    return c.json({ error: 'Pembayaran belum aktif. Coba lagi nanti.' }, 503);
  }
  await c.env.DB.prepare(`INSERT INTO orders (id, session_id, bet, amount, status, provider, name, email, mobile, event_id, client_json, report_token, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(orderId, s.id, bet.slug, bet.price, provider.name, name, email, mobile, eventId, client, randomId(18), now()).run();
  try {
    const pay = await provider.create({
      orderId, title: `${bet.brand}: Laporan Lengkap`, amount: bet.price, name, email, mobile,
      returnUrl: `${baseUrl(c)}/${bet.slug}/order/${orderId}`,
    });
    await c.env.DB.prepare('UPDATE orders SET provider_ref = ?, pay_link = ? WHERE id = ?').bind(pay.ref, pay.link, orderId).run();
    await logEvent(c.env, { bet: bet.slug, variant: s.variant, name: 'checkout_start', sessionId: s.id, visitorId: clip(b.visitorId, 40) });
    return c.json({ orderId, link: pay.link });
  } catch (err) {
    console.error('payment create failed', err);
    return c.json({ error: 'Pembayaran sedang bermasalah. Coba lagi sebentar lagi.' }, 502);
  }
});

type OrderRow = {
  id: string; session_id: string; bet: string; amount: number; status: string; provider: string; provider_ref: string | null;
  pay_link: string | null; name: string | null; email: string | null; mobile: string | null; event_id: string; client_json: string | null;
  report_token: string; capi_sent: number; created_at: number; paid_at: number | null;
};

/** Confirms status with the provider and, on first payment, kicks off report generation + CAPI. */
async function refreshOrder(env: Env, o: OrderRow, waitUntil: (p: Promise<unknown>) => void): Promise<OrderRow> {
  if (o.status !== 'pending' || !o.provider_ref) return o;
  const status = await getProvider(env).status(o.provider_ref);
  if (status === 'pending') return o;
  if (status === 'expired') {
    await env.DB.prepare("UPDATE orders SET status = 'expired' WHERE id = ? AND status = 'pending'").bind(o.id).run();
    return { ...o, status: 'expired' };
  }
  return markPaid(env, o, waitUntil);
}

async function markPaid(env: Env, o: OrderRow, waitUntil: (p: Promise<unknown>) => void): Promise<OrderRow> {
  const paidAt = now();
  const upd = await env.DB.prepare("UPDATE orders SET status = 'paid', paid_at = ? WHERE id = ? AND status != 'paid'").bind(paidAt, o.id).run();
  const paid = { ...o, status: 'paid', paid_at: paidAt };
  if (upd.meta.changes > 0) {
    const s = await env.DB.prepare('SELECT variant FROM sessions WHERE id = ?').bind(o.session_id).first<{ variant: string | null }>();
    await env.DB.prepare("INSERT OR IGNORE INTO reports (order_id, status, attempts, updated_at) VALUES (?, 'pending', 0, ?)").bind(o.id, paidAt).run();
    await logEvent(env, { bet: o.bet, variant: s?.variant, name: 'purchase', sessionId: o.session_id, value: o.amount });
    // The report is written when the buyer opens the report page (see /api/reports), not here:
    // background work (waitUntil) is cut off ~30s after the response, and AI reports take longer.
    waitUntil(sendCapi(env, paid));
  }
  return paid;
}

async function sendCapi(env: Env, o: OrderRow) {
  try {
    if (await sendPurchase(env, o)) await env.DB.prepare('UPDATE orders SET capi_sent = 1 WHERE id = ?').bind(o.id).run();
  } catch (err) {
    console.error('CAPI failed', err);
  }
}

const MAX_AI_ATTEMPTS = 3;
const LOCK_MS = 3 * 60 * 1000; // a generation that hasn't finished in 3 minutes is considered dead

/**
 * Writes the report for a paid order. Only one generation runs per order at a time:
 * the row is locked by setting status = 'generating'. Call it with await, inside a request
 * or the cron handler, never in waitUntil.
 */
async function buildReport(env: Env, orderId: string) {
  const t = now();
  const lock = await env.DB.prepare(`UPDATE reports SET status = 'generating', updated_at = ?
    WHERE order_id = ? AND (status IN ('pending', 'failed') OR (status = 'generating' AND updated_at < ?))`)
    .bind(t, orderId, t - LOCK_MS).run();
  if (lock.meta.changes === 0) return; // ready, or another request is writing it
  const row = await env.DB.prepare(`SELECT r.attempts, s.bet, s.variant, s.answers_json
    FROM reports r JOIN orders o ON o.id = r.order_id JOIN sessions s ON s.id = o.session_id WHERE r.order_id = ?`)
    .bind(orderId).first<{ attempts: number; bet: string; variant: string | null; answers_json: string }>();
  if (!row) return;
  const bet = getBet(row.bet)!;
  const answers = JSON.parse(row.answers_json) as Answers;
  const result = bet.score(answers, row.variant ?? undefined);
  let content: ReportContent;
  if (env.AI_API_KEY && row.attempts < MAX_AI_ATTEMPTS) {
    try {
      const ai = await generateAiReport(env, bet.reportPrompt(result, answers));
      content = { ...ai, disclaimer: bet.disclaimer, generatedBy: 'ai' };
    } catch (err) {
      console.error('AI report failed', err);
      await env.DB.prepare("UPDATE reports SET attempts = attempts + 1, status = 'failed', error = ?, updated_at = ? WHERE order_id = ?")
        .bind(String(err).slice(0, 500), now(), orderId).run();
      if (row.attempts + 1 < MAX_AI_ATTEMPTS) return; // next poll or cron retries
      content = bet.templateReport(result, answers); // give up on AI, customer still gets a report
    }
  } else {
    content = bet.templateReport(result, answers);
  }
  await env.DB.prepare("UPDATE reports SET status = 'ready', content_json = ?, error = NULL, updated_at = ? WHERE order_id = ?")
    .bind(JSON.stringify(content), now(), orderId).run();
}

app.get('/api/orders/:id', async (c) => {
  const o = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(c.req.param('id')).first<OrderRow>();
  if (!o) return c.json({ error: 'not found' }, 404);
  const fresh = await refreshOrder(c.env, o, (p) => c.executionCtx.waitUntil(p));
  const r = await c.env.DB.prepare('SELECT status FROM reports WHERE order_id = ?').bind(o.id).first<{ status: string }>();
  return c.json({
    status: fresh.status,
    amount: fresh.amount,
    eventId: fresh.event_id,
    payLink: fresh.status === 'pending' ? fresh.pay_link : null,
    reportToken: fresh.status === 'paid' ? fresh.report_token : null,
    reportStatus: r?.status ?? null,
  });
});

// Midtrans calls this when a transaction changes. We verify the signature, then confirm with the status API.
app.post('/api/webhooks/midtrans', async (c) => {
  const body = await c.req.json<Record<string, string>>().catch(() => ({} as Record<string, string>));
  if (!c.env.MIDTRANS_SERVER_KEY || !(await verifyMidtransSignature(body, c.env.MIDTRANS_SERVER_KEY))) {
    return c.json({ error: 'invalid signature' }, 401);
  }
  const o = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ? AND provider = 'midtrans'").bind(body.order_id).first<OrderRow>();
  if (o) await refreshOrder(c.env, o, (p) => c.executionCtx.waitUntil(p));
  return c.json({ ok: true }); // 200 so Midtrans stops retrying
});

// Mayar calls this on payment events. The body is not trusted: we re-check recent pending orders with the API.
app.post('/api/webhooks/mayar', async (c) => {
  c.executionCtx.waitUntil(recheckPending(c.env, (p) => c.executionCtx.waitUntil(p), 30));
  return c.json({ ok: true });
});

async function recheckPending(env: Env, waitUntil: (p: Promise<unknown>) => void, limit: number) {
  const { results } = await env.DB.prepare("SELECT * FROM orders WHERE status = 'pending' AND created_at > ? ORDER BY created_at DESC LIMIT ?")
    .bind(now() - 26 * 3600 * 1000, limit).all<OrderRow>();
  for (const o of results) await refreshOrder(env, o, waitUntil);
}

// Local testing only: simulates a successful payment.
app.post('/api/mock/pay/:id', async (c) => {
  if (c.env.PAYMENT_PROVIDER !== 'mock' || !/^http:\/\/(localhost|127\.0\.0\.1)/.test(baseUrl(c))) return c.json({ error: 'disabled' }, 403);
  const o = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(c.req.param('id')).first<OrderRow>();
  if (!o) return c.json({ error: 'not found' }, 404);
  await markPaid(c.env, o, (p) => c.executionCtx.waitUntil(p));
  return c.json({ ok: true, returnUrl: `/${o.bet}/order/${o.id}` });
});

// ---------- Reports ----------
app.get('/api/reports/:token', async (c) => {
  const o = await c.env.DB.prepare("SELECT id, bet FROM orders WHERE report_token = ? AND status = 'paid'").bind(c.req.param('token')).first<{ id: string; bet: string }>();
  if (!o) return c.json({ error: 'not found' }, 404);
  const r = await c.env.DB.prepare('SELECT status, content_json FROM reports WHERE order_id = ?').bind(o.id).first<{ status: string; content_json: string | null }>();
  if (r?.status === 'ready') return c.json({ bet: o.bet, status: 'ready', content: JSON.parse(r.content_json!) });
  // Write it now, inside this request (the browser waits). The lock makes concurrent polls return 'pending'.
  await buildReport(c.env, o.id);
  const after = await c.env.DB.prepare('SELECT status, content_json FROM reports WHERE order_id = ?').bind(o.id).first<{ status: string; content_json: string | null }>();
  if (after?.status === 'ready') return c.json({ bet: o.bet, status: 'ready', content: JSON.parse(after.content_json!) });
  return c.json({ bet: o.bet, status: 'pending' });
});

// ---------- Admin funnel stats ----------
function isAdmin(c: Context<{ Bindings: Env }>) {
  const key = (c.req.query('key') ?? c.req.header('x-admin-key') ?? '').trim();
  const expected = (c.env.ADMIN_KEY ?? '').trim();
  return !!expected && key === expected;
}

app.get('/api/admin/stats', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'unauthorized' }, 401);
  const days = Math.min(90, Math.max(1, Number(c.req.query('days') ?? 14)));
  const since = now() - days * 86_400_000;
  const { results: ev } = await c.env.DB.prepare(`SELECT bet, COALESCE(variant, '-') AS variant, name,
      COUNT(*) AS n, COUNT(DISTINCT COALESCE(visitor_id, session_id)) AS uniq, COALESCE(SUM(value), 0) AS value
    FROM events WHERE created_at > ? AND name != 'quiz_q' GROUP BY bet, variant, name`).bind(since).all<{ bet: string; variant: string; name: string; n: number; uniq: number; value: number }>();
  const { results: wl } = await c.env.DB.prepare('SELECT bet, COUNT(*) AS n FROM waitlist WHERE created_at > ? GROUP BY bet').bind(since).all<{ bet: string; n: number }>();
  const { results: reports } = await c.env.DB.prepare(`SELECT r.status, COUNT(*) AS n FROM reports r JOIN orders o ON o.id = r.order_id WHERE o.paid_at > ? GROUP BY r.status`)
    .bind(since).all<{ status: string; n: number }>();
  // How many people answered each question, to see where they quit.
  const { results: questions } = await c.env.DB.prepare(`SELECT bet, COALESCE(variant, '-') AS variant, value AS q,
      COUNT(DISTINCT COALESCE(visitor_id, session_id)) AS uniq
    FROM events WHERE created_at > ? AND name = 'quiz_q' GROUP BY bet, variant, value ORDER BY bet, variant, value`)
    .bind(since).all<{ bet: string; variant: string; q: number; uniq: number }>();
  return c.json({ days, bets: Object.keys(BETS), events: ev, waitlist: wl, reports, questions });
});

// Generates an AI report for a completed quiz session without payment, so you can check quality. Not stored.
app.post('/api/admin/test-report', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'unauthorized' }, 401);
  const b = await c.req.json<{ sessionId?: string }>().catch(() => ({} as { sessionId?: string }));
  const s = b.sessionId
    ? await c.env.DB.prepare('SELECT bet, variant, answers_json FROM sessions WHERE id = ? AND answers_json IS NOT NULL').bind(b.sessionId).first<{ bet: string; variant: string | null; answers_json: string }>()
    : await c.env.DB.prepare('SELECT bet, variant, answers_json FROM sessions WHERE answers_json IS NOT NULL ORDER BY created_at DESC LIMIT 1').first<{ bet: string; variant: string | null; answers_json: string }>();
  if (!s) return c.json({ error: 'No completed quiz yet. Finish the quiz once first.' }, 404);
  if (!c.env.AI_API_KEY) return c.json({ error: 'AI_API_KEY is not set' }, 400);
  const bet = getBet(s.bet)!;
  const answers = JSON.parse(s.answers_json) as Answers;
  const result = bet.score(answers, s.variant ?? undefined);
  const started = now();
  try {
    const ai = await generateAiReport(c.env, bet.reportPrompt(result, answers));
    return c.json({ model: c.env.AI_MODEL, ms: now() - started, profile: result.profileId, content: { ...ai, disclaimer: bet.disclaimer, generatedBy: 'ai' } });
  } catch (err) {
    return c.json({ error: String(err).slice(0, 500) }, 502);
  }
});

app.get('/api/admin/waitlist', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'unauthorized' }, 401);
  const { results } = await c.env.DB.prepare('SELECT bet, variant, contact, created_at FROM waitlist ORDER BY created_at DESC LIMIT 5000').all();
  return c.json(results);
});

app.all('/api/*', (c) => c.json({ error: 'not found' }, 404));

// Everything else: the React app (static assets with SPA fallback).
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const wait = (p: Promise<unknown>) => ctx.waitUntil(p);
    await recheckPending(env, wait, 50);
    // Reports nobody opened yet (buyer closed the tab): write them here, one at a time.
    const { results: stuck } = await env.DB.prepare("SELECT order_id FROM reports WHERE status != 'ready' ORDER BY updated_at LIMIT 5").all<{ order_id: string }>();
    for (const r of stuck) await buildReport(env, r.order_id);
    const { results: noCapi } = await env.DB.prepare("SELECT * FROM orders WHERE status = 'paid' AND capi_sent = 0 AND paid_at > ? LIMIT 20")
      .bind(now() - 6 * 86_400_000).all<OrderRow>();
    for (const o of noCapi) wait(sendCapi(env, o));
  },
};
