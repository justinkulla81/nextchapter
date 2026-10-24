// A member's career high point (owner, 2026-10-23): the highest level they reached,
// scaled by the employer where they reached it. "VP at a 10,000+ person company" and
// "VP at a 15-person firm" are the same title and very different careers.
//
// Stored on CandidateProfile.searchExpansion.careerHighPoint (no new column):
//   { derived?: CareerHighPoint, member?: CareerHighPoint }
// `derived` comes from their work history with the existing company-size resolver's
// static list and permanent cache only (never an LLM call); `member` is their own
// correction and always wins. Pure and client-safe.
//
// How matching reads it (memberPeakWindow, used by job-fit-bucket.ts with the job's
// employer scale from level-flex.ts):
//   - peak at a non-startup employer under ~50 people: matches like one level lower at
//     scale (a VP there fits Director / Senior Manager roles), but startup roles at the
//     peak level still fit;
//   - peak at a non-startup employer of ~50-200: also fits one level lower;
//   - peak at a large employer (5,000+): startup and small-company roles one level up
//     fit (a big-company VP is a startup CEO candidate), and big-company roles one level
//     down fit (Director roles at scale);
//   - peak at a startup, at a mid-size employer, or of unknown size: no change.

import type { CompanySizeBand } from '@prisma/client'
import type { EmployerScale } from '@/lib/jobs/level-flex'

export const CAREER_LEVELS = ['IC', 'Manager', 'Director', 'VP', 'C-Suite'] as const
export type CareerLevel = (typeof CAREER_LEVELS)[number]

export const SIZE_BANDS: CompanySizeBand[] = ['MICRO', 'SMALL', 'SMALL_MID', 'MID', 'MID_LARGE', 'LARGE', 'ENTERPRISE', 'MEGA']

export interface CareerHighPoint {
  level: CareerLevel
  sizeBand: CompanySizeBand | null
  startup: boolean
  companyName?: string | null
  title?: string | null
  source: 'derived' | 'member'
  at: string
}

export interface CareerHighPointStore {
  derived?: CareerHighPoint
  member?: CareerHighPoint
}

function readPoint(x: unknown, source: 'derived' | 'member'): CareerHighPoint | undefined {
  if (!x || typeof x !== 'object') return undefined
  const o = x as Record<string, unknown>
  if (!CAREER_LEVELS.includes(o.level as CareerLevel)) return undefined
  const band = SIZE_BANDS.includes(o.sizeBand as CompanySizeBand) ? (o.sizeBand as CompanySizeBand) : null
  return {
    level: o.level as CareerLevel,
    sizeBand: band,
    startup: o.startup === true,
    companyName: typeof o.companyName === 'string' ? o.companyName.slice(0, 200) : null,
    title: typeof o.title === 'string' ? o.title.slice(0, 200) : null,
    source,
    at: typeof o.at === 'string' ? o.at : '',
  }
}

export function readCareerHighPointStore(json: unknown): CareerHighPointStore {
  const o = (json ?? {}) as Record<string, unknown>
  const out: CareerHighPointStore = {}
  const derived = readPoint(o.derived, 'derived')
  const member = readPoint(o.member, 'member')
  if (derived) out.derived = derived
  if (member) out.member = member
  return out
}

/** The point that counts: the member's own correction, else the derived one. */
export function effectiveCareerHighPoint(store: CareerHighPointStore | null | undefined): CareerHighPoint | null {
  return store?.member ?? store?.derived ?? null
}

const SIZE_LABEL: Record<CompanySizeBand, string> = {
  MICRO: 'a 1-10 person',
  SMALL: 'an 11-50 person',
  SMALL_MID: 'a 51-200 person',
  MID: 'a 200-1,000 person',
  MID_LARGE: 'a 1,000-5,000 person',
  LARGE: 'a 5,000-20,000 person',
  ENTERPRISE: 'a 20,000+ person',
  MEGA: 'a 100,000+ person',
}
export const SIZE_CHOICE_LABEL: Record<CompanySizeBand, string> = {
  MICRO: '1-10 people',
  SMALL: '11-50 people',
  SMALL_MID: '51-200 people',
  MID: '200-1,000 people',
  MID_LARGE: '1,000-5,000 people',
  LARGE: '5,000-20,000 people',
  ENTERPRISE: '20,000-100,000 people',
  MEGA: '100,000+ people',
}

/** "VP at a 10,000+ person company", "VP at a startup (11-50 people)", "VP" when the size is unknown. */
export function careerHighPointLine(p: CareerHighPoint): string {
  if (p.startup) return p.sizeBand ? `${p.level} at a startup (${SIZE_CHOICE_LABEL[p.sizeBand]})` : `${p.level} at a startup`
  return p.sizeBand ? `${p.level} at ${SIZE_LABEL[p.sizeBand]} company` : p.level
}

/** What kind of employer the peak was at, for matching. null = no adjustment. */
export function peakScale(p: CareerHighPoint | null | undefined): EmployerScale | null {
  if (!p) return null
  if (p.startup) return 'startup'
  if (!p.sizeBand) return null
  if (p.sizeBand === 'MICRO' || p.sizeBand === 'SMALL') return 'tiny'
  if (p.sizeBand === 'SMALL_MID') return 'small'
  if (p.sizeBand === 'LARGE' || p.sizeBand === 'ENTERPRISE' || p.sizeBand === 'MEGA') return 'large'
  return 'mid'
}

/**
 * The member's level window, adjusted for where their peak was reached and what kind of
 * employer the job is at. `window` is the window the caller already worked out (it may be
 * widened by the size-calibrated levelRankScore), `base` the points of the level itself,
 * `step` the points per level (15). A small-employer peak REPLACES the levelRankScore
 * widening (the same size signal, never counted twice); a large-employer peak only ever
 * widens what is there. The lower edge stays just above a level and a half below the
 * stated level, so a peak never pulls in jobs below the member's stage window as fits.
 */
export function memberPeakWindow(
  window: { lo: number; hi: number },
  base: number | null,
  peak: EmployerScale | null,
  jobScale: EmployerScale | null,
  step: number
): { lo: number; hi: number } {
  if (!peak || peak === 'startup' || peak === 'mid' || base === null) return window
  const jobIsSmall = jobScale === 'startup' || jobScale === 'tiny' || jobScale === 'small'
  if (peak === 'tiny') {
    // Startup roles at their own level still fit; elsewhere they match a level lower.
    return { lo: base - step - 7, hi: jobScale === 'startup' ? base : base - step }
  }
  if (peak === 'small') return { lo: base - step, hi: base }
  // peak === 'large'
  if (jobIsSmall) return { lo: window.lo, hi: Math.max(window.hi, base + step) }
  if (jobScale === 'large') return { lo: Math.min(window.lo, base - step), hi: window.hi }
  return window
}

/**
 * The window adjustment applies when the point speaks for the level the member is matched
 * at: their own correction always, a derived one only when it names their stated level.
 */
export function peakForMatching(store: CareerHighPointStore | null | undefined, highestLevelReached: string | null | undefined): CareerHighPoint | null {
  const p = effectiveCareerHighPoint(store)
  if (!p) return null
  if (p.source === 'member') return p
  return highestLevelReached && p.level === highestLevelReached ? p : null
}

// ── Derivation (pure; the server wrapper resolves sizes and startup flags) ──────────

const LEVEL_ORDER: Record<CareerLevel, number> = { IC: 0, Manager: 1, Director: 2, VP: 3, 'C-Suite': 4 }

export interface HighPointEntry {
  level: string | null
  companyName: string
  title: string
  startDate: Date
  sizeBand: CompanySizeBand | null
  startup: boolean
}

/** The highest-level entry; ties go to the larger known employer, then the most recent. */
export function deriveCareerHighPoint(entries: HighPointEntry[], now = new Date()): CareerHighPoint | null {
  const ranked = entries
    .filter((e): e is HighPointEntry & { level: CareerLevel } => CAREER_LEVELS.includes(e.level as CareerLevel))
    .sort((a, b) =>
      LEVEL_ORDER[b.level] - LEVEL_ORDER[a.level] ||
      (b.sizeBand ? SIZE_BANDS.indexOf(b.sizeBand) : -1) - (a.sizeBand ? SIZE_BANDS.indexOf(a.sizeBand) : -1) ||
      b.startDate.getTime() - a.startDate.getTime()
    )
  const top = ranked[0]
  if (!top) return null
  return {
    level: top.level,
    sizeBand: top.sizeBand,
    startup: top.startup,
    companyName: top.companyName,
    title: top.title,
    source: 'derived',
    at: now.toISOString(),
  }
}
