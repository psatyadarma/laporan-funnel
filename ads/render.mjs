// AI ad pipeline: turns each bet's hooks into ready-to-upload Meta ad creatives.
//
//   node ads/render.mjs [--app URL] [--link URL] [--only peta-rezeki[:weton]] [--no-video]
//
// --app   where to read bet configs and screenshot the real landing pages (default: http://localhost:8788)
// --link  public site used in ad links (default: LIVE_URL env or the workers.dev URL)
// Output: ads/out/<bet>/<hook>/{feed.png, story.png, reel.mp4}, ads/out/ads.csv, ads/out/index.html
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CAMPAIGNS } from './copy.mjs';
import { feedHtml, indexHtml, storyHtml, videoHtml } from './templates.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const APP = (opt('app', process.env.APP_URL ?? 'http://localhost:8788')).replace(/\/$/, '');
const LINK = (opt('link', process.env.LIVE_URL ?? 'https://laporan-funnel.psatyadarma2.workers.dev')).replace(/\/$/, '');
const ONLY = opt('only', '');
const VIDEO = !args.includes('--no-video');
const FPS = 30, DURATION = 9.5;

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'ads/out');
const fontDir = resolve(root, 'node_modules/@fontsource/plus-jakarta-sans/files');
const fonts = [500, 700, 800].map((weight) => ({ weight, b64: readFileSync(`${fontDir}/plus-jakarta-sans-latin-${weight}-normal.woff2`).toString('base64') }));

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const rows = [];
const csv = [['bet', 'hook', 'ad_name', 'format', 'file', 'headline', 'primary_text', 'description', 'cta_button', 'url', 'objective', 'audience']];

try {
  for (const [slug, campaign] of Object.entries(CAMPAIGNS)) {
    if (ONLY && !ONLY.startsWith(slug)) continue;
    const res = await fetch(`${APP}/api/bets/${slug}`);
    if (!res.ok) throw new Error(`Can't read bet config ${slug} from ${APP} (${res.status}). Is the app running?`);
    const bet = await res.json();
    for (const [hookId, copy] of Object.entries(campaign.hooks)) {
      if (ONLY.includes(':') && ONLY !== `${slug}:${hookId}`) continue;
      const hook = bet.hooks.find((h) => h.id === hookId);
      if (!hook) throw new Error(`${slug} has no hook "${hookId}" (check ads/copy.mjs)`);
      if (copy.headline.length > 40) throw new Error(`${slug}:${hookId} headline is over 40 characters`);
      const dir = resolve(out, slug, hookId);
      mkdirSync(dir, { recursive: true });
      console.log(`→ ${slug} hook ${hookId}`);

      // 1. Screenshot the real landing page on a phone (tagged as test traffic so stats ignore it)
      const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
      await phone.addInitScript(() => { try { localStorage.setItem('vid', 'test-ads'); } catch {} });
      await phone.goto(`${APP}/${slug}?h=${encodeURIComponent(hookId)}`, { waitUntil: 'networkidle' });
      await phone.waitForSelector('h1');
      // Use the bundled brand font even where Google Fonts is unreachable
      await phone.addStyleTag({ content: fonts.map((f) => `@font-face{font-family:'Plus Jakarta Sans';font-weight:${f.weight};src:url(data:font/woff2;base64,${f.b64}) format('woff2');}`).join('') });
      await phone.evaluate(() => document.fonts.ready);
      await phone.waitForTimeout(700);
      const shot = (await phone.screenshot()).toString('base64');
      await phone.close();

      const data = { theme: bet.theme, brand: bet.brand, hook, copy, endCta: campaign.endCta, shot, fonts };
      const page = await browser.newPage();

      // 2. Feed 1080x1350 and story 1080x1920 images
      await page.setViewportSize({ width: 1080, height: 1350 });
      await page.setContent(feedHtml(data));
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${dir}/feed.png` });
      await page.setViewportSize({ width: 1080, height: 1920 });
      await page.setContent(storyHtml(data));
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${dir}/story.png` });

      // 3. Reel: render each frame, then encode with ffmpeg
      if (VIDEO) {
        await page.setContent(videoHtml(data));
        await page.evaluate(() => document.fonts.ready);
        const frames = resolve(dir, 'frames');
        rmSync(frames, { recursive: true, force: true });
        mkdirSync(frames);
        const total = Math.round(FPS * DURATION);
        for (let f = 0; f < total; f++) {
          await page.evaluate((t) => window.render(t), f / FPS);
          await page.screenshot({ path: `${frames}/${String(f).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 88 });
        }
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${frames}/%04d.jpg`,
          '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', `${dir}/reel.mp4`]);
        rmSync(frames, { recursive: true, force: true });
      }
      await page.close();

      // 4. Copy + tracked link
      const url = `${LINK}/${slug}?h=${encodeURIComponent(hookId)}&utm_source=meta&utm_medium=paid&utm_campaign=${slug}-hooktest&utm_content=${encodeURIComponent(hookId)}`;
      const audience = copy.audience ?? campaign.audience;
      writeFileSync(`${dir}/copy.txt`, `HEADLINE: ${copy.headline}\nDESCRIPTION: ${copy.description}\nCTA BUTTON: ${campaign.ctaButton}\nLINK: ${url}\nAUDIENCE: ${audience}\n\nPRIMARY TEXT:\n${copy.primary}\n`);
      const rel = `${slug}/${hookId}`;
      const hasReel = existsSync(`${dir}/reel.mp4`);
      rows.push({ bet: slug, hook: hookId, feed: `${rel}/feed.png`, story: `${rel}/story.png`, reel: hasReel ? `${rel}/reel.mp4` : '', headline: copy.headline, primary: copy.primary, audience, url });
      for (const [format, file] of [['feed', 'feed.png'], ['story', 'story.png'], ...(hasReel ? [['reel', 'reel.mp4']] : [])]) {
        csv.push([slug, hookId, `${slug}_${hookId}_${format}`, format, `${rel}/${file}`, copy.headline, copy.primary, copy.description, campaign.ctaButton, url + `-${format}`, campaign.objective, audience]);
      }
    }
  }
} finally {
  await browser.close();
}

mkdirSync(out, { recursive: true });
const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
writeFileSync(`${out}/ads.csv`, csv.map((r) => r.map(q).join(',')).join('\n') + '\n');
writeFileSync(`${out}/index.html`, indexHtml(rows));
console.log(`\nDone: ${rows.length} hooks → ${out}/index.html and ads.csv`);
