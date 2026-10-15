import type { Prisma } from '@prisma/client'
import { EARLY_CAREER_RUNGS, earlyCareerInEmails, memberStageWindow, windowIncludesRung, type StageMember } from '@/lib/jobs/career-stage'

/**
 * Mid-level professional jobs ("one tier down": Financial Analyst, Software
 * Engineer, Accountant — rung MID_IC, rank 30 in job-seniority) and, below
 * them, the early-career rungs (ENTRY_IC, EARLY_IC; career-stage.ts). They are
 * on the board for the members whose stage window includes them, and never in
 * emails unless the owner turns MID_LEVEL_IN_EMAILS / EARLY_CAREER_IN_EMAILS on.
 */
export const MID_LEVEL_RUNG = 'MID_IC'

/** Live-board filter that leaves mid-level jobs out (jobs with no level stay in). */
export const EXCLUDE_MID_LEVEL_WHERE: Prisma.ExclusiveJobPostingWhereInput = {
  OR: [{ level: null }, { level: { not: MID_LEVEL_RUNG } }],
}

/**
 * Whether the board shows mid-level jobs to this member by default: when the
 * mid-level stage is inside their stage window (their stage, one up, one down;
 * career-stage.ts). Director, VP and C-suite members don't see them unless they
 * pick "Mid-level" in the seniority filter.
 */
export function midLevelRelevantFor(member: StageMember): boolean {
  return windowIncludesRung(memberStageWindow(member), MID_LEVEL_RUNG)
}

/** Owner switch for emails (fresh-job alerts, Job Search Daily, coach digest). Off unless set to "true". */
export function midLevelInEmails(env: Record<string, string | undefined> = process.env): boolean {
  return env.MID_LEVEL_IN_EMAILS === 'true'
}

/**
 * Drops mid-level jobs from an email's job list unless the owner has allowed
 * them, and early-career jobs (entry level, early career) likewise.
 */
export function emailSafeJobs<T extends { level?: string | null }>(jobs: T[], env: Record<string, string | undefined> = process.env): T[] {
  const mid = midLevelInEmails(env)
  const early = earlyCareerInEmails(env)
  return jobs.filter((j) => (mid || j.level !== MID_LEVEL_RUNG) && (early || !(EARLY_CAREER_RUNGS as (string | null | undefined)[]).includes(j.level)))
}
