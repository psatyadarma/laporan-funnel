// Shared types for every bet. A bet = one config file in src/bets/.

export type BetMode = 'waitlist' | 'live';

/** One lander variant per ad hook. Ads link to /<bet>?h=<id> so the page repeats the ad's promise. */
export interface HookVariant {
  id: string; // "1", "2", "3", "weton" ...
  eyebrow?: string;
  headline: string;
  sub: string;
  cta: string;
  /** Optional overrides so a variant can set its own expectations. */
  bullets?: string[];
  trust?: string;
}

export interface QuizOption {
  id: string;
  label: string;
  /** Points added to scoring dimensions, e.g. { E: 2, risk: 1 }. */
  points?: Record<string, number>;
}

interface QuestionBase {
  id: string;
  prompt: string;
  help?: string;
  /** Only asked when the visitor came in on one of these hook variants (e.g. ['weton']). */
  onlyForVariants?: string[];
}

export type QuizQuestion =
  | (QuestionBase & { kind: 'choice'; options: QuizOption[] })
  | (QuestionBase & { kind: 'date'; optional?: boolean })
  | (QuestionBase & { kind: 'text'; placeholder?: string; optional?: boolean });

export function askedFor(q: QuizQuestion, variant: string | null | undefined): boolean {
  return !q.onlyForVariants || q.onlyForVariants.includes(variant ?? '');
}

export type Answers = Record<string, string>;

export interface Scores {
  [dimension: string]: number;
}

/** What scoring returns. `profileId` picks the profile; `facts` are extra computed facts (e.g. weton). */
export interface ScoreResult {
  profileId: string;
  scores: Scores;
  facts: Record<string, string | number>;
}

export interface Preview {
  title: string; // e.g. profile name
  tagline: string;
  insights: string[]; // 3 free insights
  teaser: string; // e.g. "Jalur rezeki #1: ..."
  lockedSections: string[]; // titles shown blurred
  extra?: Record<string, string>;
}

export interface ReportSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface ReportContent {
  title: string;
  subtitle: string;
  intro: string;
  sections: ReportSection[];
  closing: string;
  disclaimer: string;
  generatedBy: 'ai' | 'template';
}

export interface BetTheme {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  accentInk: string;
  font: string; // Google font family name
}

/** Public part of a bet config (sent to the browser). */
export interface PublicBetConfig {
  slug: string;
  brand: string;
  mode: BetMode;
  theme: BetTheme;
  hooks: HookVariant[];
  landerBullets: string[];
  trustLine: string;
  waitlist: { title: string; sub: string; placeholder: string; button: string; thanks: string };
  questions: QuizQuestion[];
  price: number;
  anchorPrice?: number;
  paywall: { title: string; sub: string; includes: string[]; guarantee: string; button: string };
  analyzingLines: string[];
  disclaimer: string;
  metaPixelId?: string;
}

/** Full bet config, used on the server only. */
export interface BetConfig extends PublicBetConfig {
  score(answers: Answers, variant?: string): ScoreResult;
  preview(result: ScoreResult, answers: Answers): Preview;
  /** Fallback report written from fixed profile content when AI is unavailable. */
  templateReport(result: ScoreResult, answers: Answers): ReportContent;
  /** Prompt for AI report generation. Must ask for JSON matching ReportContent (minus generatedBy/disclaimer). */
  reportPrompt(result: ScoreResult, answers: Answers): { system: string; user: string };
}

export function toPublic(b: BetConfig): PublicBetConfig {
  const { score: _s, preview: _p, templateReport: _t, reportPrompt: _r, ...pub } = b;
  return pub;
}
