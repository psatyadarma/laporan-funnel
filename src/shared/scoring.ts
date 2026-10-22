import type { Answers, QuizQuestion, Scores } from './types';

/**
 * Adds up option points for every answered choice question.
 * Returns raw totals and the maximum possible per dimension, so dimensions that
 * appear in fewer questions are not disadvantaged (use normalized()).
 */
export function sumPoints(questions: QuizQuestion[], answers: Answers): { totals: Scores; max: Scores } {
  const totals: Scores = {};
  const max: Scores = {};
  for (const q of questions) {
    if (q.kind !== 'choice') continue;
    // max possible for each dimension = the best option for that dimension in this question
    const best: Scores = {};
    for (const o of q.options) {
      for (const [dim, pts] of Object.entries(o.points ?? {})) {
        best[dim] = Math.max(best[dim] ?? 0, pts);
      }
    }
    for (const [dim, pts] of Object.entries(best)) max[dim] = (max[dim] ?? 0) + pts;
    const chosen = q.options.find((o) => o.id === answers[q.id]);
    for (const [dim, pts] of Object.entries(chosen?.points ?? {})) totals[dim] = (totals[dim] ?? 0) + pts;
  }
  return { totals, max };
}

export function normalized(totals: Scores, max: Scores, dims: string[]): Scores {
  const out: Scores = {};
  for (const d of dims) out[d] = max[d] ? (totals[d] ?? 0) / max[d] : 0;
  return out;
}

/** Highest dimension; ties broken by the order of `dims` (deterministic). */
export function topDimension(scores: Scores, dims: string[]): string {
  let best = dims[0];
  for (const d of dims) if ((scores[d] ?? 0) > (scores[best] ?? 0)) best = d;
  return best;
}

// ---------- Weton (Javanese day + pasaran) ----------
// Anchor: 17 August 1945 (Proklamasi) is widely recorded as Jumat Legi.
// In tradition the Javanese day starts at sunset; pass afterSunset for births after maghrib.
const PASARAN = ['Legi', 'Pahing', 'Pon', 'Wage', 'Kliwon'] as const;
const PASARAN_NEPTU: Record<string, number> = { Legi: 5, Pahing: 9, Pon: 7, Wage: 4, Kliwon: 8 };
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;
const HARI_NEPTU: Record<string, number> = { Minggu: 5, Senin: 4, Selasa: 3, Rabu: 7, Kamis: 8, Jumat: 6, Sabtu: 9 };

/**
 * @param afterSunset born after maghrib: in Javanese tradition the day has already changed, so the weton is the next day's.
 */
export function weton(isoDate: string, afterSunset = false): { hari: string; pasaran: string; neptu: number; label: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return null;
  const utc = Date.UTC(+m[1], +m[2] - 1, +m[3]) + (afterSunset ? 86_400_000 : 0);
  if (Number.isNaN(utc)) return null;
  const anchor = Date.UTC(1945, 7, 17);
  const days = Math.round((utc - anchor) / 86_400_000);
  const pasaran = PASARAN[((days % 5) + 5) % 5];
  const hari = HARI[new Date(utc).getUTCDay()];
  const neptu = HARI_NEPTU[hari] + PASARAN_NEPTU[pasaran];
  return { hari, pasaran, neptu, label: `${hari} ${pasaran}` };
}
