export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  PUBLIC_BASE_URL: string;
  /** "mock" for local testing; "midtrans" or "mayar" for real payments. */
  PAYMENT_PROVIDER: string;
  MAYAR_API_BASE: string;
  MAYAR_API_KEY?: string;
  /** Midtrans server key (Settings → Access Keys). Sandbox keys start with "SB-Mid-server-". */
  MIDTRANS_SERVER_KEY?: string;
  /** "true" for real payments, anything else uses the Midtrans sandbox. */
  MIDTRANS_PRODUCTION?: string;
  /** Any OpenAI-compatible chat completions API (OpenRouter, OpenAI, ...). Without a key, reports use the built-in template. */
  AI_BASE_URL: string;
  AI_MODEL: string;
  AI_API_KEY?: string;
  ADMIN_KEY?: string;
  /** JSON map of bet slug → Meta Pixel ID, e.g. {"peta-rezeki":"1234567890"} */
  META_PIXEL_IDS?: string;
  META_CAPI_TOKEN?: string;
  /** JSON map of bet slug → TikTok Pixel ID, e.g. {"peta-rezeki":"CXXXXXXXXXXXXXXX"} */
  TIKTOK_PIXEL_IDS?: string;
  /** TikTok Events API access token (Events Manager → pixel → Settings → Generate access token). */
  TIKTOK_EVENTS_TOKEN?: string;
  /** Override for tests. Default https://business-api.tiktok.com */
  TIKTOK_API_BASE?: string;
  /** Resend API key. Without it, no emails are sent (the report link is still shown on screen). */
  RESEND_API_KEY?: string;
  /** Sender address on a domain verified in Resend, e.g. laporan@petarezeki.id. The display name is the bet's brand. */
  EMAIL_FROM?: string;
  /** Override for tests. Default https://api.resend.com */
  EMAIL_API_BASE?: string;
}

import { idFor } from './hash';

export const pixelIdFor = (env: Env, bet: string) => idFor(env.META_PIXEL_IDS, bet);
export const tiktokPixelIdFor = (env: Env, bet: string) => idFor(env.TIKTOK_PIXEL_IDS, bet);
