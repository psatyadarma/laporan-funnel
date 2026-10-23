import type { Env } from './env';
import { tiktokPixelIdFor } from './env';
import { normalizeMobile } from './payments';
import { sha256 } from './hash';

interface PurchaseOrder {
  bet: string;
  amount: number;
  email: string | null;
  mobile: string | null;
  event_id: string;
  client_json: string | null;
  paid_at: number | null;
}

/** Body for TikTok Events API v1.3 (web). Exported for unit tests. */
export async function tiktokPurchaseBody(pixelId: string, o: PurchaseOrder, fallbackUrl: string) {
  const client = (o.client_json ? JSON.parse(o.client_json) : {}) as { ip?: string; ua?: string; ttp?: string; ttclid?: string; url?: string };
  const user: Record<string, string> = {};
  if (client.ttclid) user.ttclid = client.ttclid;
  if (client.ttp) user.ttp = client.ttp;
  if (client.ip) user.ip = client.ip;
  if (client.ua) user.user_agent = client.ua;
  if (o.email) user.email = await sha256(o.email);
  if (o.mobile) user.phone = await sha256('+' + normalizeMobile(o.mobile)); // E.164
  return {
    event_source: 'web',
    event_source_id: pixelId,
    data: [{
      event: 'CompletePayment',
      event_time: Math.floor((o.paid_at ?? Date.now()) / 1000),
      // Same id the browser pixel uses, so TikTok counts the purchase once.
      event_id: o.event_id,
      user,
      page: { url: client.url ?? fallbackUrl },
      properties: {
        currency: 'IDR',
        value: o.amount,
        content_type: 'product',
        contents: [{ content_id: `${o.bet}-report`, content_name: `${o.bet} laporan`, quantity: 1, price: o.amount }],
      },
    }],
  };
}

/** Sends CompletePayment to TikTok Events API. Returns true if sent or not configured. */
export async function sendTiktokPurchase(env: Env, o: PurchaseOrder): Promise<boolean> {
  const pixelId = tiktokPixelIdFor(env, o.bet);
  if (!pixelId || !env.TIKTOK_EVENTS_TOKEN) return true;
  const body = await tiktokPurchaseBody(pixelId, o, `${env.PUBLIC_BASE_URL || ''}/${o.bet}`);
  const res = await fetch(`${env.TIKTOK_API_BASE || 'https://business-api.tiktok.com'}/open_api/v1.3/event/track/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Access-Token': env.TIKTOK_EVENTS_TOKEN },
    body: JSON.stringify(body),
  });
  if (!res.ok) return false;
  // TikTok answers HTTP 200 with a non-zero "code" on errors.
  const j = await res.json<{ code?: number; message?: string }>().catch(() => ({ code: -1 } as { code?: number; message?: string }));
  if (j.code !== 0) console.error('TikTok Events API error', j.code, j.message);
  return j.code === 0;
}
