import { describe, expect, it, vi, afterEach } from 'vitest';
import { clean, generateAiReport, parseReport } from '../../src/worker/ai';
import type { Env } from '../../src/worker/env';

// Builds a report in the plain-text layout the AI is asked to use.
function report(sections: string[], { closing = true, extra = '' } = {}) {
  const body = sections.map((h) => `## ${h}\nParagraf untuk ${h} dengan "kutipan" dan apostrof Jum'at.\n- poin satu\n- poin dua`).join('\n\n');
  return `JUDUL: Dimas: Kreator Konsisten\nSUBJUDUL: Satu kalimat.\nPEMBUKA: Pembuka.\n\n${body}${extra}${closing ? '\n\n## Penutup\nMulai minggu ini.' : ''}`;
}
const EIGHT = ['Profilmu', 'Kekuatan utamamu', 'Titik buta', '3 jalur rezeki', '10 pekerjaan', 'Kebiasaan uang', 'Partner bisnis idealmu', 'Rencana 90 hari'];

describe('parseReport: completeness guards (regression: cut-off report on 22 Oct)', () => {
  it('rejects a report without Penutup when closing is required', () => {
    expect(() => parseReport(report(EIGHT, { closing: false }), { requireClosing: true })).toThrow(/Penutup/);
  });
  it('rejects a report that stops mid-section (the real failure)', () => {
    const cut = report(EIGHT.slice(0, 7), { closing: false }) + '\n\n## Rencana 90 hari\nBulan 1: Fondasi dan portofolio\n\nMinggu 1: Tentukan satu layanan utama (';
    expect(() => parseReport(cut, { requireClosing: true, minSections: 8 })).toThrow();
  });
  it('rejects a report with fewer sections than the bet requires', () => {
    expect(() => parseReport(report(EIGHT.slice(0, 6)), { requireClosing: true, minSections: 8 })).toThrow(/too few sections \(6 of 8\)/);
  });
  it('accepts a complete report', () => {
    const r = parseReport(report(EIGHT), { requireClosing: true, minSections: 8 });
    expect(r.sections.filter((s) => s.heading)).toHaveLength(8);
    expect(r.closing).toBe('Mulai minggu ini.');
  });
});

describe('parseReport: formatting', () => {
  it('strips bold and italic markdown', () => {
    expect(clean('*Langkah pertama:* Dalam dua minggu')).toBe('Langkah pertama: Dalam dua minggu');
    expect(clean('profilmu menekankan karya yang *rutin*, jadi')).toBe('profilmu menekankan karya yang rutin, jadi');
    expect(clean('**Penting** dan __juga__ _ini_')).toBe('Penting dan juga ini');
    expect(clean('5 * 3 = 15 dan harga Rp*')).toBe('5 * 3 = 15 dan harga Rp*'); // lone asterisks stay
  });
  it('keeps paragraph → bullets → paragraph order (regression: Partner section)', () => {
    const txt = report(EIGHT.slice(0, 2), { closing: false }) +
      '\n\n## Partner bisnis idealmu\nPartner idealmu adalah Negosiator.\n\nBeberapa ciri:\n- Nyaman soal uang\n- Jujur\n\nKamu tidak harus langsung punya partner.\n\n## Penutup\nSelesai.';
    const r = parseReport(txt);
    const i = r.sections.findIndex((s) => s.heading === 'Partner bisnis idealmu');
    expect(r.sections[i].paragraphs).toEqual(['Partner idealmu adalah Negosiator.', 'Beberapa ciri:']);
    expect(r.sections[i].bullets).toEqual(['Nyaman soal uang', 'Jujur']);
    expect(r.sections[i + 1]).toMatchObject({ heading: '', paragraphs: ['Kamu tidak harus langsung punya partner.'] });
  });
  it('tolerates code fences and a markdown # title', () => {
    const txt = '```\n# Judul Saja\n\n## A\nisi\n\n## B\nisi\n\n## C\nisi\n\n## Penutup\nok\n```';
    expect(parseReport(txt, { requireClosing: true }).title).toBe('Judul Saja');
  });
});

describe('generateAiReport: provider responses', () => {
  const env = { AI_BASE_URL: 'https://ai.test/v1', AI_MODEL: 'm', AI_API_KEY: 'k' } as Env;
  const reply = (content: string, finish_reason = 'stop', status = 200) =>
    vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason }] }), { status }));
  afterEach(() => vi.unstubAllGlobals());

  it('rejects responses cut off by the token limit', async () => {
    vi.stubGlobal('fetch', reply(report(EIGHT), 'length'));
    await expect(generateAiReport(env, { system: 's', user: 'u' }, 8)).rejects.toThrow(/cut off/);
  });
  it('rejects HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('overloaded', { status: 529 })));
    await expect(generateAiReport(env, { system: 's', user: 'u' })).rejects.toThrow(/529/);
  });
  it('sends the format instructions and a high token limit', async () => {
    const f = reply(report(EIGHT));
    vi.stubGlobal('fetch', f);
    await generateAiReport(env, { system: 'SYS', user: 'USR' }, 8);
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.max_tokens).toBeGreaterThanOrEqual(12000);
    expect(body.messages[0].content).toContain('FORMAT JAWABAN');
    expect(body.response_format).toBeUndefined();
  });
});
