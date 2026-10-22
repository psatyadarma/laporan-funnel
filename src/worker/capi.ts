import type { Env } from './env';
import { pixelIdFor } from './env';
import { normalizeMobile } from './payments';

async function sha256(value: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value.trim().toLowerCase()));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface PurchaseOrder {
  bet: string;
  amount: number;
  email: string | null;
  mobile: string | null;
  event_id: string;
  client_json: string | null;
  paid_at: number | null;
}

/**
 * Sends the Purchase event to Meta Conversions API. The browser pixel sends the same
 * event with the same event_id, so Meta deduplicates them. Returns true if sent (or not configured).
 */
export async function sendPurchase(env: Env, o: PurchaseOrder): Promise<boolean> {
  const pixelId = pixelIdFor(env, o.bet);
  if (!pixelId || !env.META_CAPI_TOKEN) return true; // nothing to send
  const client = (o.client_json ? JSON.parse(o.client_json) : {}) as { ip?: string; ua?: string; fbp?: string; fbc?: string; url?: string };
  const user_data: Record<string, unknown> = {
    client_ip_address: client.ip,
    client_user_agent: client.ua,
    fbp: client.fbp,
    fbc: client.fbc,
  };
  if (o.email) user_data.em = [await sha256(o.email)];
  if (o.mobile) user_data.ph = [await sha256(normalizeMobile(o.mobile))];
  const body = {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor((o.paid_at ?? Date.now()) / 1000),
      event_id: o.event_id,
      action_source: 'website',
      event_source_url: client.url ?? `${env.PUBLIC_BASE_URL || ''}/${o.bet}`,
      user_data,
      custom_data: { currency: 'IDR', value: o.amount },
    }],
  };
  const res = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${env.META_CAPI_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.ok;
}
