import { describe, expect, it } from 'vitest';
import { BETS } from '../../src/bets';
// @ts-expect-error plain JS module
import { CAMPAIGNS } from '../../ads/copy.mjs';

type Copy = { video: string[]; primary: string; headline: string; description: string; audience?: string; tiktok: { ad: string; caption: string }; tiktokTags?: string[] };
type Campaign = { objective: string; audience: string; ctaButton: string; endCta: string; tiktokTags: string[]; hooks: Record<string, Copy> };

// Words that break Meta policy or our honesty rules if they appear as claims in ads.
const BANNED = /\bkaya\b|dijamin|pasti (untung|cuan|sukses|berhasil)|\bcuan\b|penghasilan (pasti|tetap) rp|takdir|nasibmu/i;

describe.each(Object.entries(CAMPAIGNS as Record<string, Campaign>))('ad copy: %s', (slug, campaign) => {
  it('belongs to a real bet and real hooks', () => {
    const bet = BETS[slug];
    expect(bet).toBeDefined();
    for (const id of Object.keys(campaign.hooks)) expect(bet.hooks.map((h) => h.id)).toContain(id);
  });
  it('fits Meta limits and our copy rules', () => {
    for (const [id, c] of Object.entries(campaign.hooks)) {
      expect(c.headline.length, `${slug}:${id} headline`).toBeLessThanOrEqual(40);
      expect(c.video, `${slug}:${id} needs 3 Reel lines`).toHaveLength(3);
      for (const line of c.video) expect(line.length, `${slug}:${id} Reel line too long`).toBeLessThanOrEqual(70);
      expect(c.primary.length).toBeGreaterThan(80);
      expect(c.primary.length).toBeLessThanOrEqual(500);
      expect(`${c.primary} ${c.headline} ${c.video.join(' ')}`, `${slug}:${id} banned claim`).not.toMatch(BANNED);
    }
  });
  it('fits TikTok limits: ad text 12–100 chars, no emoji, hashtags', () => {
    const emoji = /\p{Extended_Pictographic}/u;
    for (const tag of campaign.tiktokTags) expect(tag).toMatch(/^#[a-z0-9]+$/);
    for (const [id, c] of Object.entries(campaign.hooks)) {
      expect(c.tiktok, `${slug}:${id} needs TikTok copy`).toBeDefined();
      expect(c.tiktok.ad.length, `${slug}:${id} TikTok ad text`).toBeGreaterThanOrEqual(12);
      expect(c.tiktok.ad.length, `${slug}:${id} TikTok ad text`).toBeLessThanOrEqual(100);
      expect(c.tiktok.ad, `${slug}:${id} TikTok ad text has emoji`).not.toMatch(emoji);
      expect(c.tiktok.caption.length).toBeLessThanOrEqual(2000);
      for (const tag of c.tiktokTags ?? []) expect(tag).toMatch(/^#[a-z0-9]+$/);
      expect(`${c.tiktok.ad} ${c.tiktok.caption}`, `${slug}:${id} banned claim`).not.toMatch(BANNED);
    }
  });
});
