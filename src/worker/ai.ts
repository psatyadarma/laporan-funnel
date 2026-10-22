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
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI request failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content ?? '';
  return parseReport(text);
}

/** Extracts and validates the report JSON. Throws if the shape is wrong. */
export function parseReport(text: string): AiReport {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI response has no JSON object');
  const raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
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
  return {
    title: str(raw.title, 'title'),
    subtitle: str(raw.subtitle, 'subtitle'),
    intro: str(raw.intro, 'intro'),
    sections,
    closing: str(raw.closing, 'closing'),
  };
}
