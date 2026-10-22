import type { Env } from './env';

export type PayStatus = 'pending' | 'paid' | 'expired';

export interface CreatePaymentInput {
  orderId: string;
  title: string;
  amount: number;
  name: string;
  email: string;
  mobile: string;
  returnUrl: string;
}

export interface PaymentProvider {
  name: string;
  create(input: CreatePaymentInput): Promise<{ ref: string; link: string }>;
  status(ref: string): Promise<PayStatus>;
}

/** Indonesian numbers to 62xxxxxxxx digits (Mayar wants digits only). */
export function normalizeMobile(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  if (d.startsWith('8')) d = '62' + d;
  return d;
}

// Mayar "Single Payment Request" API (docs.mayar.id/api-reference-v2/reqpayment).
// Mayar's webhook has no documented signature, so we never trust webhook bodies:
// payment status is always confirmed by calling GET /payments/{id}.
function mayar(env: Env): PaymentProvider {
  const base = env.MAYAR_API_BASE.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${env.MAYAR_API_KEY}`, 'Content-Type': 'application/json' };
  return {
    name: 'mayar',
    async create(i) {
      const res = await fetch(`${base}/payments/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: i.title,
          amount: i.amount,
          email: i.email,
          mobile: normalizeMobile(i.mobile),
          description: `${i.title} (order ${i.orderId})`,
          redirectUrl: i.returnUrl,
          expiredAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          extraData: { orderId: i.orderId },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: { id?: string; link?: string }; messages?: string };
      if (!res.ok || !json.data?.id || !json.data.link) {
        throw new Error(`Mayar create failed (${res.status}): ${json.messages ?? 'no message'}`);
      }
      return { ref: json.data.id, link: json.data.link };
    },
    async status(ref) {
      const res = await fetch(`${base}/payments/${encodeURIComponent(ref)}`, { headers });
      if (!res.ok) return 'pending';
      const json = (await res.json()) as { data?: { status?: string } };
      const s = (json.data?.status ?? '').toLowerCase();
      if (s === 'paid') return 'paid';
      if (s === 'closed' || s === 'expired') return 'expired';
      return 'pending';
    },
  };
}

// Midtrans Snap (docs.midtrans.com). Individuals can register with a KTP ("Individual – Starter Pack":
// QRIS, GoPay, bank transfer; cards need NPWP). Notifications are signed; status is also confirmed via the API.
function midtransHosts(env: Env) {
  const prod = env.MIDTRANS_PRODUCTION === 'true';
  return {
    snap: prod ? 'https://app.midtrans.com/snap/v1/transactions' : 'https://app.sandbox.midtrans.com/snap/v1/transactions',
    api: prod ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com',
  };
}

function midtransAuth(env: Env) {
  return { Authorization: `Basic ${btoa(`${env.MIDTRANS_SERVER_KEY}:`)}`, 'Content-Type': 'application/json', Accept: 'application/json' };
}

/** Maps a Midtrans transaction_status (+ fraud_status) to our status. */
export function midtransStatus(transactionStatus: string, fraudStatus?: string): PayStatus {
  const t = transactionStatus.toLowerCase();
  if ((t === 'settlement' || t === 'capture') && (!fraudStatus || fraudStatus.toLowerCase() === 'accept')) return 'paid';
  if (['expire', 'cancel', 'deny', 'failure'].includes(t)) return 'expired';
  return 'pending';
}

/** Verifies a Midtrans notification: signature_key = SHA512(order_id + status_code + gross_amount + server key). */
export async function verifyMidtransSignature(
  body: { order_id?: string; status_code?: string; gross_amount?: string; signature_key?: string },
  serverKey: string,
): Promise<boolean> {
  if (!body.order_id || !body.status_code || !body.gross_amount || !body.signature_key) return false;
  const data = new TextEncoder().encode(body.order_id + body.status_code + body.gross_amount + serverKey);
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-512', data))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hash === body.signature_key.toLowerCase();
}

function midtrans(env: Env): PaymentProvider {
  const hosts = midtransHosts(env);
  return {
    name: 'midtrans',
    async create(i) {
      const res = await fetch(hosts.snap, {
        method: 'POST',
        headers: midtransAuth(env),
        body: JSON.stringify({
          transaction_details: { order_id: i.orderId, gross_amount: i.amount },
          item_details: [{ id: 'report', price: i.amount, quantity: 1, name: i.title.slice(0, 50) }],
          customer_details: { first_name: i.name.slice(0, 50), email: i.email, phone: i.mobile },
          callbacks: { finish: i.returnUrl },
          expiry: { unit: 'hour', duration: 24 },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { token?: string; redirect_url?: string; error_messages?: string[] };
      if (!res.ok || !json.redirect_url) {
        throw new Error(`Midtrans create failed (${res.status}): ${(json.error_messages ?? []).join('; ') || 'no message'}`);
      }
      return { ref: i.orderId, link: json.redirect_url }; // Midtrans identifies the payment by our order_id
    },
    async status(ref) {
      const res = await fetch(`${hosts.api}/v2/${encodeURIComponent(ref)}/status`, { headers: midtransAuth(env) });
      if (!res.ok) return 'pending';
      const json = (await res.json()) as { status_code?: string; transaction_status?: string; fraud_status?: string };
      if (json.status_code === '404' || !json.transaction_status) return 'pending'; // buyer hasn't picked a method yet
      return midtransStatus(json.transaction_status, json.fraud_status);
    },
  };
}

/** Local testing: the "payment page" is /mock-pay/:orderId in this app. */
function mock(env: Env): PaymentProvider {
  return {
    name: 'mock',
    async create(i) {
      return { ref: `mock_${i.orderId}`, link: `${new URL(i.returnUrl).origin}/mock-pay/${i.orderId}` };
    },
    async status(ref) {
      const row = await env.DB.prepare('SELECT status FROM orders WHERE provider_ref = ?').bind(ref).first<{ status: string }>();
      return (row?.status as PayStatus) ?? 'pending';
    },
  };
}

export function getProvider(env: Env): PaymentProvider {
  if (env.PAYMENT_PROVIDER === 'midtrans') {
    if (!env.MIDTRANS_SERVER_KEY) throw new Error('MIDTRANS_SERVER_KEY is not set');
    return midtrans(env);
  }
  if (env.PAYMENT_PROVIDER === 'mayar') {
    if (!env.MAYAR_API_KEY) throw new Error('MAYAR_API_KEY is not set');
    return mayar(env);
  }
  // Mock payments only on localhost, so a misconfigured production deploy can never hand out free reports.
  if (env.PAYMENT_PROVIDER === 'mock' && /^http:\/\/(localhost|127\.0\.0\.1)/.test(env.PUBLIC_BASE_URL || '')) return mock(env);
  throw new Error(`Payment provider not configured (${env.PAYMENT_PROVIDER})`);
}
