// My jobs rules — status, the apply-click → Gmail application match, the "did you
// apply?" prompt, the funnel and the skills-gap insight. Pure: no database, so every
// rule is unit-tested (src/test/my-jobs.test.ts). Loading and saving live in
// my-jobs-data.ts; the UI in components/dashboard/my-jobs/.

import { orgNamesMatch } from '@/lib/text/org-name-match'
import type { JobSkillGap } from '@/lib/jobs/job-skill-gap'

export const JOB_STATUSES = ['saved', 'applied', 'interviewing', 'offer', 'closed'] as const
export type JobStatus = (typeof JOB_STATUSES)[number]
/** The four statuses an application moves through (adjacent buttons on a card). */
export const APPLICATION_STATUSES = ['applied', 'interviewing', 'offer', 'closed'] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  closed: 'Closed',
}

export function isApplicationStatus(v: unknown): v is ApplicationStatus {
  return typeof v === 'string' && (APPLICATION_STATUSES as readonly string[]).includes(v)
}

export interface ApplicationDates {
  appliedAt: Date | null
  interviewLandedAt: Date | null
  offerReceivedAt: Date | null
  declinedAt: Date | null
}

/** An application's status from its JobPosting dates (null = not applied). */
export function applicationStatus(a: ApplicationDates | null | undefined): ApplicationStatus | null {
  if (!a) return null
  if (a.declinedAt) return 'closed'
  if (a.offerReceivedAt) return 'offer'
  if (a.interviewLandedAt) return 'interviewing'
  if (a.appliedAt) return 'applied'
  return null
}

/**
 * The JobPosting fields to write to move an application to `to`. Moving forward
 * fills the dates it skipped (Offer implies applied and interviewed); moving back
 * clears the later ones, so a mis-click is undone exactly. Dates already set are kept.
 */
export function statusChangeData(current: ApplicationDates, to: ApplicationStatus, now: Date): ApplicationDates {
  const rank = APPLICATION_STATUSES.indexOf(to)
  return {
    appliedAt: current.appliedAt ?? now,
    interviewLandedAt: rank >= 1 && to !== 'closed' ? (current.interviewLandedAt ?? now) : to === 'closed' ? current.interviewLandedAt : null,
    offerReceivedAt: to === 'offer' ? (current.offerReceivedAt ?? now) : to === 'closed' ? current.offerReceivedAt : null,
    declinedAt: to === 'closed' ? (current.declinedAt ?? now) : null,
  }
}

// ── apply click → Gmail application ──────────────────────────────────────

/** An application confirmation counts for a click up to this long after it. */
export const CLICK_TO_EMAIL_WINDOW_DAYS = 14
const DAY_MS = 86_400_000
const STOP = new Set(['the', 'and', 'of', 'for', 'a', 'an', 'to', 'in', 'at', 'with', 'senior', 'sr', 'jr', 'lead', 'remote', 'hybrid', 'us', 'usa'])

function titleTokens(t: string): Set<string> {
  return new Set(
    t
      .toLowerCase()
      .replace(/&/g, ' and ')
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 1 && !STOP.has(w))
  )
}

/** Same role? One title's words mostly inside the other's (≥ 60% of the shorter). */
export function titlesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const x = titleTokens(a)
  const y = titleTokens(b)
  if (x.size === 0 || y.size === 0) return false
  let shared = 0
  for (const w of x) if (y.has(w)) shared++
  return shared / Math.min(x.size, y.size) >= 0.6
}

export interface ClickRef {
  companyName: string | null
  title: string
  clickedAt: Date
}

export interface EmailApplication {
  id: string
  companyName: string | null
  title: string | null
  appliedAt: Date | null
}

/**
 * The Gmail-detected application that came from this board click, if any: same
 * company, sent from a day before the click (a confirmation can land before our
 * click log on a slow connection) to 14 days after, and the same role when the
 * email names one. A confirmation that names a different role at the same company
 * is a different application. The nearest one in time wins.
 */
export function matchClickToApplication(click: ClickRef, apps: EmailApplication[]): EmailApplication | null {
  if (!click.companyName) return null
  const from = click.clickedAt.getTime() - DAY_MS
  const to = click.clickedAt.getTime() + CLICK_TO_EMAIL_WINDOW_DAYS * DAY_MS
  const fits = apps.filter((a) => {
    if (!a.appliedAt || !a.companyName) return false
    const t = a.appliedAt.getTime()
    if (t < from || t > to) return false
    if (!orgNamesMatch(a.companyName, click.companyName!)) return false
    return !a.title || titlesMatch(a.title, click.title)
  })
  fits.sort(
    (a, b) => Math.abs(a.appliedAt!.getTime() - click.clickedAt.getTime()) - Math.abs(b.appliedAt!.getTime() - click.clickedAt.getTime())
  )
  return fits[0] ?? null
}

// ── "did you apply?" ─────────────────────────────────────────────────────

/**
 * Ask on the member's next visit to the board or Home after they open an employer's
 * application — at least this long after the click, so it isn't asked while they're
 * still on the employer's site.
 */
export const PROMPT_AFTER_MS = 10 * 60 * 1000
/** Stop asking about clicks older than this. */
export const PROMPT_UNTIL_DAYS = 7
/** "Not yet" asks again after this long (once the click is still recent enough). */
export const PROMPT_SNOOZE_DAYS = 2

export type PromptAnswer = 'applied' | 'not_yet' | 'not_interested'

export function shouldAskDidYouApply(
  item: {
    lastClickedAt: Date | null
    applied: boolean
    promptAnswer: string | null
    promptAnsweredAt: Date | null
    dismissedAt: Date | null
  },
  now: Date
): boolean {
  if (!item.lastClickedAt || item.applied || item.dismissedAt) return false
  const ageMs = now.getTime() - item.lastClickedAt.getTime()
  if (ageMs < PROMPT_AFTER_MS || ageMs > PROMPT_UNTIL_DAYS * DAY_MS) return false
  if (item.promptAnswer === 'applied' || item.promptAnswer === 'not_interested') return false
  if (item.promptAnswer === 'not_yet' && item.promptAnsweredAt) {
    // A new click after "not yet" starts over; otherwise wait out the snooze.
    if (item.lastClickedAt > item.promptAnsweredAt) return true
    return (now.getTime() - item.promptAnsweredAt.getTime()) / DAY_MS >= PROMPT_SNOOZE_DAYS
  }
  return true
}

// ── funnel ───────────────────────────────────────────────────────────────

export interface FunnelItem {
  clicked: boolean
  application: ApplicationDates | null
}

export interface MyJobsFunnel {
  clicked: number
  applied: number
  interviewing: number
  offer: number
}

/** Clicked → applied → interviewing → offer. A stage counts every job that reached it, closed or not. */
export function myJobsFunnel(items: FunnelItem[]): MyJobsFunnel {
  const f: MyJobsFunnel = { clicked: 0, applied: 0, interviewing: 0, offer: 0 }
  for (const i of items) {
    if (i.clicked) f.clicked++
    if (i.application?.appliedAt) f.applied++
    if (i.application?.interviewLandedAt) f.interviewing++
    if (i.application?.offerReceivedAt) f.offer++
  }
  return f
}

// ── skills gap across saved + applied jobs ───────────────────────────────

export interface SkillsGapInsight {
  /** Saved/applied jobs with enough skill data to judge. */
  jobsWithData: number
  /** Skills those jobs ask for that the member doesn't show, most common first. */
  top: { skill: string; jobs: number }[]
}

/** Below this many jobs with skill data, there's no pattern to call. */
export const MIN_JOBS_FOR_INSIGHT = 2

/**
 * "8 of your 12 saved jobs ask for SQL": per job (not per employer — these are jobs
 * the member chose), only skills missing from at least two jobs. Rules only.
 */
export function skillsGapInsight(jobs: { id: string; gap: JobSkillGap }[], limit = 5): SkillsGapInsight | null {
  const withData = jobs.filter((j) => j.gap.basis !== 'none' && j.gap.requested.length > 0)
  if (withData.length < MIN_JOBS_FOR_INSIGHT) return null
  const counts = new Map<string, Set<string>>()
  for (const j of withData) for (const s of j.gap.missing) (counts.get(s) ?? counts.set(s, new Set()).get(s)!).add(j.id)
  const top = [...counts.entries()]
    .map(([skill, ids]) => ({ skill, jobs: ids.size }))
    .filter((s) => s.jobs >= MIN_JOBS_FOR_INSIGHT)
    .sort((a, b) => b.jobs - a.jobs || a.skill.localeCompare(b.skill))
    .slice(0, limit)
  if (top.length === 0) return null
  return { jobsWithData: withData.length, top }
}

export function skillsGapSentence(insight: SkillsGapInsight): string {
  const t = insight.top[0]
  return `${t.jobs} of your ${insight.jobsWithData} saved and applied jobs ask for ${t.skill}.`
}
