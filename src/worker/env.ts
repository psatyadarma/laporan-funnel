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
}

export function pixelIdFor(env: Env, bet: string): string | undefined {
  if (!env.META_PIXEL_IDS) return undefined;
  try {
    return (JSON.parse(env.META_PIXEL_IDS) as Record<string, string>)[bet];
  } catch {
    return undefined;
  }
}
