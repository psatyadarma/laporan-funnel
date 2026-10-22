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
- **Payments:** Midtrans Snap by default (QRIS, GoPay, bank transfer; individuals register with a KTP). Mayar is also supported. Status is always confirmed with the provider's API.
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
Locally `.dev.vars` sets `PAYMENT_PROVIDER=mock` (a simulated payment page, which only works on localhost). Without `AI_API_KEY`, reports use the template. Production defaults to Midtrans; until `MIDTRANS_SERVER_KEY` is set, checkout shows "Pembayaran belum aktif" instead of handing out free reports.

## Deploy (about 30 minutes)
1. **Cloudflare:** create a free account, then `npx wrangler login`.
2. **Database:** `npx wrangler d1 create laporan` and paste the `database_id` into `wrangler.jsonc`. Then run `npm run db:migrate:remote`.
3. **Domain (optional at first):** the app works on its `workers.dev` URL. Later, add your domain in Cloudflare and attach it to the worker (Workers → laporan-funnel → Settings → Domains & Routes). `PUBLIC_BASE_URL` can stay empty; the app uses whatever URL the visitor came in on.
4. **Payments: Midtrans (default).** Register at midtrans.com as **Individual – Starter Pack** (KTP: QRIS, GoPay, bank transfer; add NPWP for cards).
   - Test first in sandbox: copy the **sandbox** Server Key (Settings → Access Keys, starts with `SB-Mid-server-`) and run `npx wrangler secret put MIDTRANS_SERVER_KEY`, or add it as a Secret in the dashboard. `MIDTRANS_PRODUCTION` is `"false"` in `wrangler.jsonc`.
   - In the Midtrans dashboard (Settings → Configuration) set the **Payment Notification URL** to `https://YOUR_DOMAIN/api/webhooks/midtrans`.
   - Go live: replace the secret with the **production** Server Key and set `MIDTRANS_PRODUCTION` to `"true"`.
   - Notifications are verified with Midtrans' SHA-512 signature, and status is also confirmed through the status API.
   - **Alternative: Mayar.** Set `PAYMENT_PROVIDER` to `"mayar"`, add `MAYAR_API_KEY`, and set the webhook URL to `https://YOUR_DOMAIN/api/webhooks/mayar`. Mayar's webhook isn't signed, so the app always re-checks status with its API.
5. **AI:** create an OpenRouter key (or use any OpenAI-compatible provider: change `AI_BASE_URL` and `AI_MODEL`). Then `npx wrangler secret put AI_API_KEY`. Budget roughly Rp1–3K per report depending on the model.
6. **Admin:** `npx wrangler secret put ADMIN_KEY`.
7. **Meta:** create a Pixel per brand. Set `META_PIXEL_IDS` in `wrangler.jsonc` vars, e.g. `{"peta-rezeki":"123","siap-nikah":"456","pilih-jurusan":"789"}`. Create a Conversions API token (Events Manager → Settings), then `npx wrangler secret put META_CAPI_TOKEN`.
8. `npm run deploy`.
9. **Test with a real Rp99K payment**, refund it in Mayar, and check: report opens, `/admin` shows a purchase, Events Manager shows one deduplicated Purchase.

## Before running ads
- Do one full purchase on your own phone with real QRIS.
- Add a privacy policy and refund page (link them in the footer) and read Meta's ad policies on income claims.
- Report delivery: buyers see their report link on screen and Mayar emails a receipt. Sending the report link by WhatsApp/email (e.g. via Fonnte or Resend) is a recommended next step, so buyers who close the tab can find it again.

## QA: how releases are protected
| Layer | What runs | When |
|---|---|---|
| Unit tests (`npm test`) | Scoring, weton, report parser (incl. the cut-off report regression), AI provider errors, payment signatures, bet config integrity | Every Cloudflare build: `npm run build` runs typecheck + unit tests, so **a failing test blocks the deploy** |
| End-to-end (`npm run test:e2e`) | A real browser clicks through lander → quiz → preview → payment → report on a phone-sized screen, with mock payments and a fake AI that can misbehave (cut off, no ending, errors, slow). Also waitlists, admin, API guards | GitHub Actions on every push and pull request |
| Smoke test (`npm run smoke`) | Checks the live site: settings present, pages and scripts load, admin protected, mock payments off, quiz scoring works | GitHub Actions ~2.5 minutes after each push to `main` |
| Real AI check | Generates one real report on the live site and checks it's complete (costs ~Rp1.000) | Manually: GitHub → Actions → QA → Run workflow → tick the box. Needs the `ADMIN_KEY` repository secret |

Run everything locally with `npm run qa`. When you change quiz content or prompts, the config tests catch broken edits before they ship.

## Add or change a bet
Copy `src/bets/peta-rezeki.ts`, change questions, scoring, profiles, preview, template report and AI prompt, register it in `src/bets/index.ts`, and set `mode: 'live'`. Waitlist-only bets live in `src/bets/waitlist-bets.ts`.

## Known limits (v0.1)
- No upsell yet (spec: Rp49K add-ons).
- Siap Nikah needs a partner-invite flow before going live (`Invite` table in the spec); Pilih Jurusan needs its quiz and campus data.
- "Simpan PDF" uses the browser's print-to-PDF.
- Weton uses the civil date; in tradition the Javanese day starts at sunset.
