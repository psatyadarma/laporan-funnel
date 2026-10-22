import type { Env } from './env';
import type { ReportContent, ReportSection } from '../shared/types';

type AiReport = Omit<ReportContent, 'disclaimer' | 'generatedBy'>;

/** Calls an OpenAI-compatible chat completions endpoint and parses the JSON report. */
export async function generateAiReport(env: Env, prompt: { system: string; user: string }): Promise<AiReport> {
  const res = await fetch(`${env.AI_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.AI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.AI_MODEL,
      temperature: 0.7,
      max_tokens: 6000,
      messages: [
        { role: 'system', content: `${prompt.system}\n\n${FORMAT_INSTRUCTIONS}` },
        { role: 'user', content: prompt.user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI request failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content ?? '';
  return parseReport(text);
}

/**
 * The AI writes plain text in this layout instead of JSON: quotes, apostrophes and
 * long Bahasa text can't break it, unlike JSON.
 */
export const FORMAT_INSTRUCTIONS = `FORMAT JAWABAN (wajib, teks biasa, BUKAN JSON, tanpa pembuka atau penutup di luar format):
JUDUL: <judul laporan, satu baris>
SUBJUDUL: <satu kalimat ringkas>
PEMBUKA: <satu paragraf pembuka>

## <Judul bagian 1>
<paragraf, pisahkan paragraf dengan baris kosong>
- <poin, jika perlu>

## <Judul bagian berikutnya>
...

## Penutup
<satu paragraf penutup>`;

const clean = (t: string) => t.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').trim();

/** Parses the plain-text report (or legacy JSON). Throws if it's too thin to sell. */
export function parseReport(text: string): AiReport {
  const trimmed = text.trim().replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim();
  if (trimmed.startsWith('{')) return parseJsonReport(trimmed);

  let title = '', subtitle = '', intro = '';
  const sections: ReportSection[] = [];
  let current: ReportSection | null = null;
  let para: string[] = [];
  let inIntro = false;
  const flush = () => {
    if (!para.length) return;
    const p = clean(para.join(' '));
    para = [];
    if (!p) return;
    if (current) current.paragraphs.push(p);
    else if (inIntro || !intro) intro = intro ? `${intro} ${p}` : p;
  };
  for (const raw of trimmed.split(/\r?\n/)) {
    const line = raw.trim();
    const field = /^(JUDUL|SUBJUDUL|PEMBUKA|TITLE|SUBTITLE|INTRO)\s*:\s*(.*)$/i.exec(line);
    if (field && !current) {
      flush();
      const key = field[1].toUpperCase();
      const val = clean(field[2]);
      if (key === 'JUDUL' || key === 'TITLE') title = val;
      else if (key === 'SUBJUDUL' || key === 'SUBTITLE') subtitle = val;
      else { inIntro = true; if (val) para.push(val); }
      continue;
    }
    if (/^#\s+/.test(line) && !current && !title) { title = clean(line.replace(/^#\s+/, '')); continue; }
    if (/^#{2,3}\s+/.test(line)) {
      flush(); inIntro = false;
      current = { heading: clean(line.replace(/^#{2,3}\s+/, '')), paragraphs: [], bullets: [] };
      sections.push(current);
      continue;
    }
    const bullet = /^([-*•])\s+(.*)$/.exec(line);
    if (bullet && current) { flush(); current.bullets!.push(clean(bullet[2])); continue; }
    if (!line) { flush(); continue; }
    para.push(line);
  }
  flush();

  // The last "Penutup" section becomes the closing.
  let closing = '';
  const last = sections[sections.length - 1];
  if (last && /penutup|closing|kata akhir/i.test(last.heading)) {
    closing = [...last.paragraphs, ...(last.bullets ?? [])].join(' ');
    sections.pop();
  }
  for (const s of sections) if (!s.bullets?.length) delete s.bullets;
  const body = sections.filter((s) => s.paragraphs.length || s.bullets?.length);
  if (!title) throw new Error('AI report missing title');
  if (body.length < 3) throw new Error(`AI report has too few sections (${body.length})`);
  return {
    title,
    subtitle: subtitle || body[0].paragraphs[0]?.split('. ')[0] || title,
    intro: intro || body[0].paragraphs[0] || '',
    sections: body,
    closing: closing || 'Mulai dari satu langkah kecil minggu ini.',
  };
}

function parseJsonReport(text: string): AiReport {
  const raw = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as Record<string, unknown>;
  const str = (v: unknown, field: string) => {
    if (typeof v !== 'string' || !v.trim()) throw new Error(`AI report missing ${field}`);
    return v.trim();
  };
  if (!Array.isArray(raw.sections) || raw.sections.length < 3) throw new Error('AI report has too few sections');
  const sections: ReportSection[] = raw.sections.map((s: unknown, i: number) => {
    const o = s as Record<string, unknown>;
    const paragraphs = Array.isArray(o.paragraphs) ? o.paragraphs.filter((p): p is string => typeof p === 'string') : [];
    const bullets = Array.isArray(o.bullets) ? o.bullets.filter((p): p is string => typeof p === 'string') : undefined;
    if (!paragraphs.length && !bullets?.length) throw new Error(`AI section ${i} is empty`);
    return { heading: str(o.heading, `sections[${i}].heading`), paragraphs, bullets };
  });
  return { title: str(raw.title, 'title'), subtitle: str(raw.subtitle, 'subtitle'), intro: str(raw.intro, 'intro'), sections, closing: str(raw.closing, 'closing') };
}
