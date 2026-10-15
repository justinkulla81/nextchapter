import type { Prisma } from '@prisma/client'
import { classifyTitleRung, type RungName } from '@/lib/jobs/job-seniority'

/**
 * The career ladder members and jobs are placed on, low to high, and the
 * window of it a member's board shows: their own stage, one up and one down
 * (owner's rule, 2026-10-15). A member changing careers (isPivoting) also
 * sees one more stage down. The seniority filter lets anyone pick any stage
 * explicitly; that choice replaces the window.
 *
 *   ENTRY            ENTRY_IC 20            0-2 years
 *   EARLY            EARLY_IC 25            2-5 years
 *   MID              MID_IC 30              5-8 years
 *   SENIOR_IC_MGR    SENIOR_IC 45, MANAGER 40
 *   SENIOR_MANAGER   SR_MANAGER 50/52, PRINCIPAL 70
 *   DIRECTOR         DIRECTOR, HEAD, CHIEF_OF_STAFF, SCHOOL_LEADER
 *   VP               VP, PARTNER
 *   EXECUTIVE        EVP_SVP, C_SUITE, BOARD
 */
export const CAREER_STAGES = ['ENTRY', 'EARLY', 'MID', 'SENIOR_IC_MGR', 'SENIOR_MANAGER', 'DIRECTOR', 'VP', 'EXECUTIVE'] as const
export type CareerStage = (typeof CAREER_STAGES)[number]

export const STAGE_RUNGS: Record<CareerStage, RungName[]> = {
  ENTRY: ['ENTRY_IC'],
  EARLY: ['EARLY_IC'],
  MID: ['MID_IC'],
  SENIOR_IC_MGR: ['SENIOR_IC', 'MANAGER'],
  SENIOR_MANAGER: ['SR_MANAGER', 'PRINCIPAL'],
  DIRECTOR: ['DIRECTOR', 'HEAD', 'CHIEF_OF_STAFF', 'SCHOOL_LEADER'],
  VP: ['VP', 'PARTNER'],
  EXECUTIVE: ['EVP_SVP', 'C_SUITE', 'BOARD'],
}

/** Rungs of the two early-career stages (never in emails unless EARLY_CAREER_IN_EMAILS). */
export const EARLY_CAREER_RUNGS: RungName[] = ['ENTRY_IC', 'EARLY_IC']
export const MID_LEVEL_RUNGS: RungName[] = ['MID_IC']

const stageIndex = (s: CareerStage) => CAREER_STAGES.indexOf(s)

export function stageOfRung(rung: string | null | undefined): CareerStage | null {
  if (!rung) return null
  for (const s of CAREER_STAGES) if ((STAGE_RUNGS[s] as string[]).includes(rung)) return s
  return null
}

/** A window of the ladder, as indexes into CAREER_STAGES (inclusive). */
export interface StageWindow {
  lo: number
  hi: number
}

export type StageMember = {
  highestLevelReached?: string | null
  yearsExperience?: number | null
  levelRankScore?: number | null
  isPivoting?: boolean | null
  /** The member's current or latest title, when known (resume). */
  resumeLatestJobTitle?: string | null
}

function stageFromYears(years: number): CareerStage {
  if (years < 2) return 'ENTRY'
  if (years < 5) return 'EARLY'
  if (years < 8) return 'MID'
  return 'SENIOR_IC_MGR'
}

// levelRankScore (level-rank.ts: IC 20, Manager 40, Director 55, VP 70, C-Suite 85
// at the anchor company size): only the manager-and-up bands say anything.
function stageFromScore(score: number): CareerStage | null {
  if (score >= 78) return 'EXECUTIVE'
  if (score >= 63) return 'VP'
  if (score >= 50) return 'DIRECTOR'
  if (score >= 35) return 'SENIOR_IC_MGR'
  return null
}

function stageFromTitle(title: string | null | undefined): CareerStage | null {
  if (!title?.trim()) return null
  return stageOfRung(classifyTitleRung(title).rung)
}

/**
 * The member's own stage, or null when nothing says. Their stated level comes
 * first; an individual contributor is placed by years of experience (then by
 * their latest title); a member with no stated level by title, years, then the
 * calibrated level score.
 */
export function memberCareerStage(m: StageMember): CareerStage | null {
  const level = (m.highestLevelReached ?? '').replace(/[_-]+/g, ' ').trim().toLowerCase()
  const years = typeof m.yearsExperience === 'number' && m.yearsExperience >= 0 ? m.yearsExperience : null
  if (/\b(c suite|chief|ceo|executive)\b/.test(level)) return 'EXECUTIVE'
  if (/\b(vp|vice president|svp|evp)\b/.test(level)) return 'VP'
  if (/\bdirector\b/.test(level)) return 'DIRECTOR'
  if (/\bmanager\b/.test(level)) {
    return stageFromTitle(m.resumeLatestJobTitle) === 'SENIOR_MANAGER' ? 'SENIOR_MANAGER' : 'SENIOR_IC_MGR'
  }
  if (level === 'ic' || /individual/.test(level)) {
    if (years !== null) return stageFromYears(years)
    const fromTitle = stageFromTitle(m.resumeLatestJobTitle)
    if (fromTitle && stageIndex(fromTitle) <= stageIndex('SENIOR_IC_MGR')) return fromTitle
    return 'MID'
  }
  const fromTitle = stageFromTitle(m.resumeLatestJobTitle)
  if (fromTitle) return fromTitle
  if (years !== null && years < 8) return stageFromYears(years)
  return m.levelRankScore != null ? stageFromScore(m.levelRankScore) : null
}

/** Members whose stage is unknown: mid-level and up, as before the early-career rungs. */
export const UNKNOWN_STAGE_WINDOW: StageWindow = { lo: stageIndex('MID'), hi: stageIndex('EXECUTIVE') }

/** The member's stage, one up and one down (two down when changing careers). */
export function memberStageWindow(m: StageMember): StageWindow {
  const stage = memberCareerStage(m)
  if (!stage) return UNKNOWN_STAGE_WINDOW
  const i = stageIndex(stage)
  const down = m.isPivoting ? 2 : 1
  return { lo: Math.max(0, i - down), hi: Math.min(CAREER_STAGES.length - 1, i + 1) }
}

export function stagesInWindow(w: StageWindow): CareerStage[] {
  return CAREER_STAGES.filter((_, i) => i >= w.lo && i <= w.hi)
}

export function rungsInWindow(w: StageWindow): RungName[] {
  return stagesInWindow(w).flatMap((s) => STAGE_RUNGS[s])
}

export function windowIncludesRung(w: StageWindow, rung: string): boolean {
  return (rungsInWindow(w) as string[]).includes(rung)
}

/** Every stage: no window (an explicit seniority-filter choice narrows by level instead). */
export const ALL_STAGES_WINDOW: StageWindow = { lo: 0, hi: CAREER_STAGES.length - 1 }

/**
 * The live-board level filter for a window, less whatever the caller leaves
 * out (emails leave out mid-level and early-career jobs unless the owner's
 * switches are on). Jobs with no level (employer-posted) always stay in.
 */
export function stageWindowWhere(w: StageWindow, exclude: RungName[] = []): Prisma.ExclusiveJobPostingWhereInput {
  const rungs = rungsInWindow(w).filter((r) => !exclude.includes(r))
  return { OR: [{ level: null }, { level: { in: rungs } }] }
}

/** Owner switch for emails (fresh-job alerts, Job Search Daily, coach digest). Off unless set to "true". */
export function earlyCareerInEmails(env: Record<string, string | undefined> = process.env): boolean {
  return env.EARLY_CAREER_IN_EMAILS === 'true'
}
