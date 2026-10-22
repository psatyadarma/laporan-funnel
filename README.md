# Laporan funnel engine

One engine for "quiz → free preview → pay once → personal report" funnels. Each bet is one config file in `src/bets/`.

| Bet | URL | Status |
|---|---|---|
| Peta Rezeki (rezeki & career report) | `/peta-rezeki` | **Live**: quiz, preview, payment, report |
| Siap Nikah (premarital compatibility) | `/siap-nikah` | Waitlist (hook test) |
| Pilih Jurusan (university major) | `/pilih-jurusan` | Waitlist (hook test) |

Ad links pick the lander headline with `?h=`: `/peta-rezeki?h=1`, `?h=2`, `?h=weton` (the weton variant also asks for a birth date and adds a weton section). Siap Nikah and Pilih Jurusan have `?h=1|2|3`. Each ad should link to the variant that repeats its hook.

## What's inside
- **Front end:** React (mobile-first), in `src/client/`.
- **Back end:** Hono on Cloudflare Workers (`src/worker/`), D1 database, cron every 10 minutes.
- **Scoring:** deterministic code (Holland RIASEC × money style → 12 profiles). The same answers always give the same profile.
- **Reports:** written by an AI model (any OpenAI-compatible API, default OpenRouter) as structured JSON. If no AI key is set, or the AI fails 3 times, a built-in template report is used, so a buyer always gets a report.
- **Payments:** Mayar (QRIS, e-wallets, VA; individuals can verify with a KTP, no NIB). Payment status is always confirmed with Mayar's API, never trusted from the webhook body.
- **Tracking:** Meta Pixel (browser) + Conversions API (server) with a shared `event_id` for deduplication, plus our own funnel events.
- **Admin:** `/admin` shows unique visitors per funnel step per bet and hook, conversion rates and revenue.

## Run locally (no accounts needed)
```bash
npm install
cp .dev.vars.example .dev.vars          # set ADMIN_KEY
npm run db:migrate:local
npm run dev                             # http://localhost:8787
npm test
```
Locally `.dev.vars` sets `PAYMENT_PROVIDER=mock` (a simulated payment page, which only works on localhost). Without `AI_API_KEY`, reports use the template. Production defaults to Mayar; until `MAYAR_API_KEY` is set, checkout shows "Pembayaran belum aktif" instead of handing out free reports.

## Deploy (about 30 minutes)
1. **Cloudflare:** create a free account, then `npx wrangler login`.
2. **Database:** `npx wrangler d1 create laporan` and paste the `database_id` into `wrangler.jsonc`. Then run `npm run db:migrate:remote`.
3. **Domain (optional at first):** the app works on its `workers.dev` URL. Later, add your domain in Cloudflare and attach it to the worker (Workers → laporan-funnel → Settings → Domains & Routes). `PUBLIC_BASE_URL` can stay empty; the app uses whatever URL the visitor came in on.
4. **Mayar:** sign up at mayar.id and complete individual verification (KTP, selfie with KTP, bank account). Create a Read & Write API key, then:
   - `npx wrangler secret put MAYAR_API_KEY`
   - `wrangler.jsonc` already uses `PAYMENT_PROVIDER: "mayar"` and the production API (`https://api.mayar.id/hl/v2`). For Mayar's sandbox, use `https://api.mayar.io/hl/v2` with a sandbox key.
   - in the Mayar dashboard, set the webhook URL to `https://YOUR_DOMAIN/api/webhooks/mayar`
5. **AI:** create an OpenRouter key (or use any OpenAI-compatible provider: change `AI_BASE_URL` and `AI_MODEL`). Then `npx wrangler secret put AI_API_KEY`. Budget roughly Rp1–3K per report depending on the model.
6. **Admin:** `npx wrangler secret put ADMIN_KEY`.
7. **Meta:** create a Pixel per brand. Set `META_PIXEL_IDS` in `wrangler.jsonc` vars, e.g. `{"peta-rezeki":"123","siap-nikah":"456","pilih-jurusan":"789"}`. Create a Conversions API token (Events Manager → Settings), then `npx wrangler secret put META_CAPI_TOKEN`.
8. `npm run deploy`.
9. **Test with a real Rp99K payment**, refund it in Mayar, and check: report opens, `/admin` shows a purchase, Events Manager shows one deduplicated Purchase.

## Before running ads
- Do one full purchase on your own phone with real QRIS.
- Add a privacy policy and refund page (link them in the footer) and read Meta's ad policies on income claims.
- Report delivery: buyers see their report link on screen and Mayar emails a receipt. Sending the report link by WhatsApp/email (e.g. via Fonnte or Resend) is a recommended next step, so buyers who close the tab can find it again.

## Add or change a bet
Copy `src/bets/peta-rezeki.ts`, change questions, scoring, profiles, preview, template report and AI prompt, register it in `src/bets/index.ts`, and set `mode: 'live'`. Waitlist-only bets live in `src/bets/waitlist-bets.ts`.

## Known limits (v0.1)
- No upsell yet (spec: Rp49K add-ons).
- Siap Nikah needs a partner-invite flow before going live (`Invite` table in the spec); Pilih Jurusan needs its quiz and campus data.
- "Simpan PDF" uses the browser's print-to-PDF.
- Weton uses the civil date; in tradition the Javanese day starts at sunset.
