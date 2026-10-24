// One flex mechanism for job levels (owner, 2026-10-23). A job keeps ONE stored level
// (ExclusiveJobPosting.level — what the level mix reports count); matching may treat it
// as a small RANGE of rungs around that level, so nobody loses a reasonable job:
//
//   UP flex (title conventions where the stored level is deliberately the lower reading):
//     - IC-style "Manager" titles stored SENIOR_IC (ic_style_manager) .......... +1 (MANAGER)
//     - mid-level "Senior" titles stored MID_IC (senior_mid_ic) ................ +1 (SENIOR_IC)
//     - quota sales "Director" titles stored SENIOR_IC (sales_director_ic) ..... +2 (MANAGER, SR_MANAGER)
//   DOWN flex (employer scale, size known only — unknown size is never guessed):
//     - non-startup employer under ~50 people (MICRO, SMALL) ................... -2
//     - non-startup employer of ~50-200 (SMALL_MID) ............................ -1
//     - a startup (VC / PE portfolio board, YC, accelerator, startup source) of
//       known size under ~200 ............................................ at most -1
//       Funded startups hire genuinely senior people at small headcounts (an eBay or
//       Google CEO at 20-100 people), so a small headcount never makes their titles
//       less senior; the stated level stays the top of the range.
//   Never: a down flex for a mega-cap employer (MEGA band, or MEGA_CAP_EMPLOYERS:
//   big tech + the Fortune 100) — VP and above there is never down-ranked.
//
// The stored level is always the TOP of a down flex and the BOTTOM of an up flex. Flex
// only changes how a job's level compares with a member's (fit scoring and the level
// distance), never which board rows a member's stage window holds.
//
// The member side has the matching "career high point" (career-high-point.ts): the peak
// level, scaled by the employer where it was reached. jobScale tells it what kind of
// employer this job is at. Pure and client-safe.

import type { CompanySizeBand } from '@prisma/client'
import {
  CONSULTING_EMPLOYERS,
  IC_STYLE_MANAGER,
  MEGA_CAP_EMPLOYERS,
  SALES_DIRECTOR_IC,
  SENIOR_CONSULTANT,
  SENIOR_MID_IC,
} from '@/lib/jobs/job-seniority-rules.generated'
import { normalizeCompanyForLevel, type RungName } from '@/lib/jobs/job-seniority'

/** What kind of employer a job is at, for the member's career-high-point adjustments. null = unknown. */
export type EmployerScale = 'startup' | 'tiny' | 'small' | 'mid' | 'large'

export interface LevelFlex {
  /** Rungs above the stored level the job also fits. */
  up: number
  /** Rungs below the stored level the job also fits. */
  down: number
  scale: EmployerScale | null
}

export const NO_FLEX: LevelFlex = { up: 0, down: 0, scale: null }

/** Board sources that run a startup portfolio (ExclusiveJobPosting.sourceCategory). */
export const STARTUP_SOURCE_CATEGORIES = new Set(['venture', 'vc_portfolio', 'startup', 'accelerator', 'pe'])

const SMALL_BANDS = new Set<CompanySizeBand>(['MICRO', 'SMALL', 'SMALL_MID'])
const TINY_BANDS = new Set<CompanySizeBand>(['MICRO', 'SMALL'])
const LARGE_BANDS = new Set<CompanySizeBand>(['LARGE', 'ENTERPRISE', 'MEGA'])

export function isMegaCapEmployer(companyName: string | null | undefined): boolean {
  const co = normalizeCompanyForLevel(companyName)
  return !!co && MEGA_CAP_EMPLOYERS.test(co)
}

/** The employer's scale: size band first; a startup flag only speaks for a small or unknown size. */
export function employerScale(opts: {
  companyName?: string | null
  companySizeBand?: CompanySizeBand | null
  startup?: boolean
}): EmployerScale | null {
  const band = opts.companySizeBand ?? null
  if ((band && LARGE_BANDS.has(band)) || isMegaCapEmployer(opts.companyName)) return 'large'
  if (opts.startup && (!band || SMALL_BANDS.has(band))) return 'startup'
  if (!band) return null
  if (TINY_BANDS.has(band)) return 'tiny'
  if (band === 'SMALL_MID') return 'small'
  return 'mid'
}

/** Up flex from the title conventions above, given the job's stored level. */
export function titleUpFlex(title: string, level: string | null | undefined, companyName?: string | null): number {
  if (!title || !level) return 0
  if (level === 'SENIOR_IC') {
    if (SALES_DIRECTOR_IC.test(title)) return 2
    if (IC_STYLE_MANAGER.test(title)) return 1
  }
  if (level === 'MID_IC') {
    const co = normalizeCompanyForLevel(companyName)
    if (SENIOR_MID_IC.test(title) || (!!co && CONSULTING_EMPLOYERS.test(co) && SENIOR_CONSULTANT.test(title))) return 1
  }
  return 0
}

/** Down flex from the employer's scale (size known only). */
export function scaleDownFlex(scale: EmployerScale | null, companySizeBand: CompanySizeBand | null | undefined): number {
  if (scale === 'tiny') return 2
  if (scale === 'small') return 1
  // A startup keeps its stated level; at most one rung down, and only with a known small size.
  if (scale === 'startup') return companySizeBand && SMALL_BANDS.has(companySizeBand) ? 1 : 0
  return 0
}

export function jobLevelFlex(job: {
  title: string
  level?: string | null
  companyName?: string | null
  companySizeBand?: CompanySizeBand | null
  sourceCategory?: string | null
}): LevelFlex {
  const startup = !!job.sourceCategory && STARTUP_SOURCE_CATEGORIES.has(job.sourceCategory)
  const scale = employerScale({ companyName: job.companyName, companySizeBand: job.companySizeBand, startup })
  return {
    up: titleUpFlex(job.title, job.level, job.companyName),
    down: scaleDownFlex(scale, job.companySizeBand),
    scale,
  }
}

// ── Rung ladder the flex moves along ─────────────────────────────────────────

const FLEX_LADDER: RungName[] = ['ENTRY_IC', 'EARLY_IC', 'MID_IC', 'SENIOR_IC', 'MANAGER', 'SR_MANAGER', 'DIRECTOR', 'VP', 'C_SUITE']
const LADDER_SLOT: Partial<Record<RungName, number>> = {
  ...Object.fromEntries(FLEX_LADDER.map((r, i) => [r, i])),
  PRINCIPAL: 6,
  CHIEF_OF_STAFF: 6,
  SCHOOL_LEADER: 6,
  HEAD: 6,
  PARTNER: 7,
  EVP_SVP: 8,
  BOARD: 8,
}

/** The lowest and highest rung a job fits once its flex is applied; null for a rung off the ladder. */
export function flexRungRange(level: string | null | undefined, flex: LevelFlex | null | undefined): { low: RungName; high: RungName } | null {
  const slot = level ? LADDER_SLOT[level as RungName] : undefined
  if (slot === undefined) return null
  const own = level as RungName
  const up = flex?.up ?? 0
  const down = flex?.down ?? 0
  return {
    low: down > 0 ? FLEX_LADDER[Math.max(0, slot - down)] : own,
    high: up > 0 ? FLEX_LADDER[Math.min(FLEX_LADDER.length - 1, slot + up)] : own,
  }
}

/**
 * Signed level gap between a member's window and a job's range, both on one points
 * scale: 0 when they overlap, negative when the job sits below the member, positive above.
 */
export function rangeGap(member: { lo: number; hi: number }, job: { lo: number; hi: number }): number {
  if (job.hi < member.lo) return job.hi - member.lo
  if (job.lo > member.hi) return job.lo - member.hi
  return 0
}
