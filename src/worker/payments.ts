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
  if (env.PAYMENT_PROVIDER === 'mayar') {
    if (!env.MAYAR_API_KEY) throw new Error('MAYAR_API_KEY is not set');
    return mayar(env);
  }
  // Mock payments only on localhost, so a misconfigured production deploy can never hand out free reports.
  if (env.PAYMENT_PROVIDER === 'mock' && /^http:\/\/(localhost|127\.0\.0\.1)/.test(env.PUBLIC_BASE_URL || '')) return mock(env);
  throw new Error(`Payment provider not configured (${env.PAYMENT_PROVIDER})`);
}
