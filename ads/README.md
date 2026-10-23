# Ad pipeline

Turns each bet's hooks into ready-to-post creatives: a feed image (1080×1350), a story image (1080×1920) and a 9.5-second Reel per hook, plus `ads.csv` (Meta copy and links) and `tiktok.csv` (TikTok ad text, organic caption with hashtags, and separate paid/organic links). The Reel is 9:16, so the same file works on TikTok.

**One click (no setup):** GitHub → Actions → **Generate ads** → Run workflow. Download the `ad-creatives` artifact when it finishes (~5 minutes). It screenshots the real landing pages on the live site.

**Locally:** `npm run ads -- --app http://localhost:8788` (needs the app running, Playwright Chromium and ffmpeg). `--only peta-rezeki:weton` renders one hook; `--no-video` skips Reels.

**New hook ideas:** tick "hook ideas" in the workflow (uses the `AI_API_KEY` repo secret), or run `AI_API_KEY=... npm run ads:ideas`. Review them, then add winners to the bet config (`src/bets/`) and `ads/copy.mjs`.

**Editing copy:** `ads/copy.mjs` holds the ad text, headline (≤ 40 characters), the three Reel lines, CTA button and audience note per hook. Hook ids must match the bet config's hooks (`?h=` on the landing page).

**Tracking:** every link carries `utm_source=meta&utm_medium=paid&utm_campaign=<bet>-hooktest&utm_content=<hook>-<format>`, and the landing page variant matches the hook, so the admin page shows results per hook.
