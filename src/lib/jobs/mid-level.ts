import type { Prisma } from '@prisma/client'

/**
 * Mid-level professional jobs ("one tier down": Financial Analyst, Software
 * Engineer, Accountant — rung MID_IC, rank 30 in job-seniority). They are on
 * the board, but only for members they suit, and never in emails unless the
 * owner turns MID_LEVEL_IN_EMAILS on.
 */
export const MID_LEVEL_RUNG = 'MID_IC'

/** Live-board filter that leaves mid-level jobs out (jobs with no level stay in). */
export const EXCLUDE_MID_LEVEL_WHERE: Prisma.ExclusiveJobPostingWhereInput = {
  OR: [{ level: null }, { level: { not: MID_LEVEL_RUNG } }],
}

const SENIOR_MEMBER_LEVEL = /\b(director|vp|vice ?president|c[- ]?suite|chief|executive|svp|evp|president)\b/i

/**
 * Whether the board shows mid-level jobs to this member by default: members
 * at manager or senior-individual level (or whose level we don't know), and
 * anyone pivoting into a new function. Director, VP and C-suite members don't
 * see them unless they pick "Mid-level" in the seniority filter.
 */
export function midLevelRelevantFor(member: { highestLevelReached?: string | null; isPivoting?: boolean | null }): boolean {
  if (member.isPivoting) return true
  const level = (member.highestLevelReached ?? '').replace(/[_-]+/g, ' ').trim()
  if (!level) return true
  return !SENIOR_MEMBER_LEVEL.test(level)
}

/** Owner switch for emails (fresh-job alerts, Job Search Daily, coach digest). Off unless set to "true". */
export function midLevelInEmails(env: Record<string, string | undefined> = process.env): boolean {
  return env.MID_LEVEL_IN_EMAILS === 'true'
}

/** Drops mid-level jobs from an email's job list unless the owner has allowed them. */
export function emailSafeJobs<T extends { level?: string | null }>(jobs: T[], env: Record<string, string | undefined> = process.env): T[] {
  return midLevelInEmails(env) ? jobs : jobs.filter((j) => j.level !== MID_LEVEL_RUNG)
}
