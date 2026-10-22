import { describe, expect, it } from 'vitest';
import { BETS } from '../../src/bets';
import { _internal } from '../../src/bets/peta-rezeki';
import { askedFor, toPublic } from '../../src/shared/types';
import type { Answers } from '../../src/shared/types';

// Config integrity: catches broken edits to quiz content before they ship.
describe.each(Object.values(BETS))('bet config: $slug', (bet) => {
  it('has unique hook ids and non-empty copy', () => {
    const ids = bet.hooks.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const h of bet.hooks) expect(h.headline && h.sub && h.cta).toBeTruthy();
  });
  it('public config hides server-only functions', () => {
    const pub = toPublic(bet) as unknown as Record<string, unknown>;
    for (const k of ['score', 'preview', 'templateReport', 'reportPrompt', 'reportMinSections']) expect(pub[k]).toBeUndefined();
    expect(() => JSON.stringify(pub)).not.toThrow();
  });
  if (bet.mode !== 'live') return;
  it('has unique question ids and at least 2 options per choice', () => {
    const ids = bet.questions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const q of bet.questions) if (q.kind === 'choice') {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(new Set(q.options.map((o) => o.id)).size).toBe(q.options.length);
    }
  });
  it('every hook variant gets a working quiz, preview, template report and prompt', () => {
    for (const h of bet.hooks) {
      const answers: Answers = {};
      for (const q of bet.questions.filter((q) => askedFor(q, h.id))) {
        answers[q.id] = q.kind === 'choice' ? q.options[0].id : q.kind === 'date' ? '1995-03-10' : 'Dimas';
      }
      const r = bet.score(answers, h.id);
      const p = bet.preview(r, answers);
      expect(p.insights.length).toBe(3);
      const t = bet.templateReport(r, answers);
      expect(t.sections.length).toBeGreaterThanOrEqual(bet.reportMinSections?.(r) ?? 3);
      const prompt = bet.reportPrompt(r, answers);
      expect(prompt.system).not.toMatch(/JSON/); // AI must not be asked for JSON (regression)
      expect(prompt.system).toMatch(/JANGAN menyebut skor/);
    }
  });
});

describe('peta rezeki profiles', () => {
  it('all 12 profiles are complete', () => {
    const ids = Object.keys(_internal.P);
    expect(ids).toHaveLength(12);
    for (const id of ids) {
      const p = _internal.P[id];
      expect(p.strengths).toHaveLength(3);
      expect(p.blindSpots).toHaveLength(3);
      expect(p.paths.job.length && p.paths.side.length && p.paths.business.length).toBeTruthy();
    }
  });
});
