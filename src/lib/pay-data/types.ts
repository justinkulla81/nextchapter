// Pay data shape: one stored figure ('pay-data' in BoardFigure) written by the nightly cron and read by the /pay-data pages, the CSV and the
// skills-that-pay lists. Client-safe. Method in docs/PAY_DATA.md; wording in src/lib/pay-data/text.ts.

export const PAY_LEVELS = ['entry', 'early', 'mid', 'senior', 'manager', 'director', 'vp'] as const
export type PayLevel = (typeof PAY_LEVELS)[number]
export const PAY_LEVEL_LABEL: Record<PayLevel, string> = {
  entry: 'Entry level',
  early: 'Early career',
  mid: 'Mid-level',
  senior: 'Senior individual contributor',
  manager: 'Manager',
  director: 'Director',
  vp: 'VP and above',
}

/** Employer headcount bands (Company.sizeBand), smallest first. */
export const SIZE_BANDS = ['MICRO', 'SMALL', 'SMALL_MID', 'MID', 'MID_LARGE', 'LARGE', 'ENTERPRISE', 'MEGA'] as const
export type SizeBand = (typeof SIZE_BANDS)[number]
export const SIZE_BAND_LABEL: Record<SizeBand, string> = {
  MICRO: '1 to 10 employees',
  SMALL: '11 to 50 employees',
  SMALL_MID: '51 to 200 employees',
  MID: '201 to 1,000 employees',
  MID_LARGE: '1,001 to 5,000 employees',
  LARGE: '5,001 to 20,000 employees',
  ENTERPRISE: '20,001 to 100,000 employees',
  MEGA: 'More than 100,000 employees',
}

/** How many jobs an employer has open now (a measure of hiring volume, not of headcount). */
export const SCALE_BANDS = ['1-4', '5-19', '20-99', '100-499', '500+'] as const
export type ScaleBand = (typeof SCALE_BANDS)[number]

/** Pay of a group of postings: annualized midpoint of the range the employer posted. */
export interface PayStat {
  /** Paid postings in the group. */
  n: number
  /** Distinct employers behind them. */
  companies: number
  p25: number
  p50: number
  p75: number
}

export interface PayGroup extends PayStat {
  key: string
  label: string
  /**
   * Gap against every other posting in the same dimension, inside cells of the same function and level (and industry, except for industry
   * itself): percent and dollars. This is the figure that holds the job mix fixed; the raw median does not. Absent when the cells are thin.
   */
  likePct?: number
  likeUsd?: number
  likeN?: number
  likeCells?: number
  /** Same group split by level; only levels with enough postings. */
  levels?: Partial<Record<PayLevel, PayStat>>
}

export interface SkillPay extends PayStat {
  skill: string
  /** Median pay of postings that do not list the skill, same data (for the raw comparison). */
  baseP50: number
  /** Raw gap, percent: median with the skill against median without. */
  rawPct: number
  /** Like-for-like gap, percent and dollars: inside cells of the same function, level and industry. Absent when the cells are too thin. */
  likePct?: number
  likeUsd?: number
  /** Postings and cells the like-for-like figure rests on. */
  likeN?: number
  likeCells?: number
  /** Functions where the skill is most often listed. */
  topFunctions: { label: string; n: number }[]
}

export interface PayData {
  computedAt: string
  /** Postings counted: live, employer-posted pay (posted or read from the text), annual equivalent between $20,000 and $1,500,000. */
  overall: PayStat
  coverage: {
    livePostings: number
    paidPostings: number
    paidWithSkills: number
    /** Share of paid postings whose employer has a size band we trust. */
    sizedShare: number
  }
  byIndustry: PayGroup[]
  byFunction: PayGroup[]
  byLevel: PayGroup[]
  bySize: PayGroup[]
  byScale: PayGroup[]
  /** Every skill with enough postings and employers, ordered by like-for-like gap, then by overall pay. */
  skills: SkillPay[]
  /** Per function, the skills with the highest median pay (own list so function pages need no scan). */
  skillsByFunction: Record<string, { skill: string; n: number; p50: number }[]>
}

/** A monthly snapshot of how many paid-pay employers had how many jobs open, kept so hiring growth can be measured once months have built up. */
export interface PayDataSnapshot {
  month: string
  computedAt: string
  /** [companyId, jobs open] for every employer with at least one paid posting. */
  open: [string, number][]
}
