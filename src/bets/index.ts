import type { BetConfig } from '../shared/types';
import { petaRezeki } from './peta-rezeki';
import { siapNikah, pilihJurusan } from './waitlist-bets';

export const BETS: Record<string, BetConfig> = {
  [petaRezeki.slug]: petaRezeki,
  [siapNikah.slug]: siapNikah,
  [pilihJurusan.slug]: pilihJurusan,
};

export function getBet(slug: string): BetConfig | undefined {
  return BETS[slug];
}
