import 'server-only'
import type { CandidateProfile } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCoachCaseload } from '@/lib/coach/caseload'
import { detectAvoidancePattern } from '@/lib/coach/pre-session-brief'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { loadBoardShortlist, postedWithinWhere } from '@/lib/jobs/board-shortlist'
import { emailSafeJobs, midLevelInEmails } from '@/lib/jobs/mid-level'
import { earlyCareerInEmails } from '@/lib/jobs/career-stage'
import { boardListingFitBucketFor, emailFitScoringVersion, isVeryStrongBoardFitFor } from '@/lib/jobs/email-fit-scoring'
import { candidateScaleLevel } from '@/lib/jobs/job-seniority'
import { boardJobCardTexts } from '@/lib/jobs/job-card-server'
import { metaLineText } from '@/lib/jobs/job-card'
import type { Grade } from '@/lib/scoring/grade'
import type { Trend } from '@/lib/coach/client-summary'

// Hard budgets so one slow query degrades a client's card instead of
// running the whole cron into its 300s function limit (which sends nothing).
const CASELOAD_BUDGET_MS = 60_000
const CLIENT_BUDGET_MS = 40_000

function withBudget<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} exceeded ${ms}ms`)), ms)
  })
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer))
}

const WINDOW_DAYS = 7 // activity counts
// New roles are the last 72h (the product's apply-early window). A 7-day window
// ranks ~120k board rows per client and ran the cron out of time on a small instance;
// the 24h alert cron ranks ~11k and finishes in ~20s.
const NEW_ROLES_HOURS = 72
const MAX_JOBS_PER_CLIENT = 3
const SHORTLIST_SIZE = 30

export interface DigestJob {
  title: string
  company: string
  url: string
  /** The client's board card verdict, meta line and why line (job-card.ts). */
  verdict: string
  meta: string
  why: string | null
}

export interface DigestClient {
  id: string
  name: string
  firstName: string
  weekNumber: number | null
  grade: Grade | null
  trend: Trend
  mood: string | null
  moodTrend: 'up' | 'down' | null
  applications: number
  interviews: number
  offers: number
  outreach: number
  pointsThisWeek: number
  pointsLastWeek: number
  daysSinceActive: number | null
  /** Why this client needs a conversation this week (stalled, risk triggers). */
  attention: string[]
  goodNews: string[]
  /** Strong-fit roles posted in the last 72 hours the client hasn't already tracked. */
  newJobs: DigestJob[]
  fullViewPath: string
}

export interface CoachWeeklyDigest {
  /** Clients who have shared their profile with this coach, needs-attention first. */
  clients: DigestClient[]
  /** Assigned clients who have not yet consented — name only, no detail. */
  notSharedNames: string[]
  /** Shared clients whose detail failed to load this run — named so the coach knows, never silently dropped. */
  unavailableNames: string[]
}

// Four cheap counts over the window. Deliberately not getWeeklyOutcomes: that
// also runs getNeedsFollowUpList, which loads a candidate's whole email
// history and ran the production instance out of memory (2026-10-15).
async function getRecentActivityCounts(candidateId: string, since: Date) {
  const [outreach, applications, interviews, offers] = await Promise.all([
    prisma.outreachLog.count({ where: { candidateId, loggedAt: { gte: since } } }),
    prisma.jobPosting.count({ where: { candidateId, appliedAt: { gte: since } } }),
    prisma.jobPosting.count({ where: { candidateId, interviewLandedAt: { gte: since } } }),
    prisma.jobPosting.count({ where: { candidateId, offerReceivedAt: { gte: since } } }),
  ])
  return { outreach, applications, interviews, offers }
}

function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}`.toLowerCase()
  } catch {
    return url.trim().toLowerCase()
  }
}

// Strong-fit board roles posted in the last 72 hours, minus anything the client
// is already tracking or has already applied to. Same fit gate as the
// client's own fresh-job alert (isVeryStrongBoardFitFor), so a coach sees what
// the client sees — nothing looser.
async function findNewStrongFitJobs(
  candidateId: string,
  candidate: CandidateProfile
): Promise<DigestJob[]> {
  const t0 = Date.now()
  const [dossier, tracked] = await Promise.all([
    isDossierUnlocked(candidateId),
    prisma.jobPosting.findMany({ where: { candidateId, url: { not: null } }, select: { url: true } }),
  ])
  console.log(`Coach digest: dossier+tracked for ${candidateId.slice(0, 8)} ${Date.now() - t0}ms`)
  const trackedUrls = new Set(tracked.map((t) => normalizeUrl(t.url)).filter((u): u is string => !!u))
  // An email: stays on the pre-v2 fit scoring until FIT_SCORING_V2_FOR_EMAILS is on.
  const fitScoring = emailFitScoringVersion()
  const board = await loadBoardShortlist({
    candidate,
    isCandidatePlus: dossier.unlocked,
    where: postedWithinWhere(NEW_ROLES_HOURS),
    size: SHORTLIST_SIZE,
    fitScoring,
    // Mid-level and early-career jobs stay out of emails until the owner turns on
    // MID_LEVEL_IN_EMAILS / EARLY_CAREER_IN_EMAILS; the member's stage window applies.
    includeMidLevel: midLevelInEmails(),
    includeEarlyCareer: earlyCareerInEmails(),
  })
  const jobs = emailSafeJobs(board.open)
    .filter((p) => !trackedUrls.has(normalizeUrl(p.url) ?? ''))
    .filter((p) => isVeryStrongBoardFitFor(fitScoring, candidate, p, candidateScaleLevel(p.level)))
    .slice(0, MAX_JOBS_PER_CLIENT)
  // Each role reads as it does on the client's own board card (job-card.ts).
  const cards = boardJobCardTexts({ candidate, shortlist: board, postings: jobs, fitBucketFor: (p) => boardListingFitBucketFor(fitScoring, candidate, p) })
  return jobs.map((p) => {
    const card = cards.get(p.id)!
    return {
      title: p.title,
      company: p.disclosure === 'CONFIDENTIAL' ? 'Confidential search' : (p.companyName ?? 'Company not listed'),
      url: p.url,
      verdict: card.verdictLabel,
      meta: metaLineText(card),
      why: card.whyLine || null,
    }
  })
}

export async function buildCoachWeeklyDigest(coachId: string, accessToken: string): Promise<CoachWeeklyDigest> {
  const [caseload, profiles] = await Promise.all([
    withBudget(getCoachCaseload(coachId), CASELOAD_BUDGET_MS, 'caseload'),
    prisma.candidateProfile.findMany({ where: { coachId } }),
  ])
  const profileById = new Map(profiles.map((p) => [p.id, p]))
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const notSharedNames: string[] = []
  const unavailableNames: string[] = []
  const clients: DigestClient[] = []

  // One client at a time: each ranks the board in memory, and doing three at
  // once on a small instance is what ran the cron out of memory/time.
  for (const entry of caseload) {
    await (async () => {
      const profile = profileById.get(entry.id)
      // Same gate as the Full Client View: being assigned is not consent.
      if (!profile || profile.coachDossierConsentedAt === null) {
        notSharedNames.push(entry.name)
        return
      }
      // One client's failed query must not drop the whole digest for the coach.
      let outcomes: Awaited<ReturnType<typeof getRecentActivityCounts>>
      let newJobs: DigestJob[]
      const t0 = Date.now()
      try {
        const timed = async <T,>(label: string, work: Promise<T>): Promise<T> => {
          const started = Date.now()
          try {
            return await work
          } finally {
            console.log(`Coach digest: ${label} for ${entry.id.slice(0, 8)} took ${Date.now() - started}ms`)
          }
        }
        ;[outcomes, newJobs] = await withBudget(
          Promise.all([
            timed('activity counts', getRecentActivityCounts(entry.id, since)),
            timed('new roles', findNewStrongFitJobs(entry.id, profile)),
          ]),
          CLIENT_BUDGET_MS,
          'client detail'
        )
      } catch (error) {
        console.error(`Coach digest: client detail failed for ${entry.id.slice(0, 8)} after ${Date.now() - t0}ms`, error)
        unavailableNames.push(entry.name)
        return
      }
      const risks = entry.triggers.filter((t) => t.type === 'RISK')
      // isStalled is the avoidance pattern, not inactivity: a committed action type
      // left incomplete week after week while other actions get done. Say which one,
      // the same way the coach's own client page does.
      const avoidance = entry.isStalled ? await detectAvoidancePattern(entry.id).catch(() => null) : null
      const attention = [
        ...(avoidance
          ? [`Keeps leaving "${avoidance.actionType}" actions incomplete (${avoidance.weeksAvoided} weeks running)`]
          : entry.isStalled
            ? ['Keeps leaving a committed action incomplete']
            : []),
        ...risks.map((t) => t.label),
      ]
      clients.push({
        id: entry.id,
        name: entry.name,
        firstName: profile.firstName || entry.name.split(' ')[0],
        weekNumber: entry.weekNumber,
        grade: entry.executionGrade,
        trend: entry.trend,
        mood: entry.sentimentLabel,
        moodTrend: entry.sentimentTrend,
        applications: outcomes.applications,
        interviews: outcomes.interviews,
        offers: outcomes.offers,
        outreach: outcomes.outreach,
        pointsThisWeek: entry.activityThisWeekPoints,
        pointsLastWeek: entry.activityLastWeekPoints,
        daysSinceActive: entry.lastActiveAt
          ? Math.floor((Date.now() - entry.lastActiveAt.getTime()) / (24 * 60 * 60 * 1000))
          : null,
        attention,
        goodNews: entry.triggers.filter((t) => t.type === 'GOOD_NEWS').map((t) => t.label),
        newJobs,
        fullViewPath: `/support/coach/clients/${accessToken}/${entry.id}/full`,
      })
    })()
  }

  clients.sort((a, b) => b.attention.length - a.attention.length || a.name.localeCompare(b.name))
  notSharedNames.sort()
  unavailableNames.sort()
  return { clients, notSharedNames, unavailableNames }
}
