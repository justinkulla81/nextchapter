import 'server-only'
import { prisma } from '@/lib/prisma'
import { getCoachCaseload } from '@/lib/coach/caseload'
import { getWeeklyOutcomes } from '@/lib/weekly/outcomes'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { loadBoardShortlist, postedWithinWhere } from '@/lib/jobs/board-shortlist'
import { emailFitScoringVersion, isVeryStrongBoardFitFor } from '@/lib/jobs/email-fit-scoring'
import { candidateScaleLevel } from '@/lib/jobs/job-seniority'
import { postedAgo } from '@/lib/jobs/competition'
import type { Grade } from '@/lib/scoring/grade'
import type { Trend } from '@/lib/coach/client-summary'

const WINDOW_DAYS = 7
const MAX_JOBS_PER_CLIENT = 3
const SHORTLIST_SIZE = 30

export interface DigestJob {
  title: string
  company: string
  location: string | null
  postedAgo: string
  url: string
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
  followUpsOwed: number
  pointsThisWeek: number
  pointsLastWeek: number
  daysSinceActive: number | null
  /** Why this client needs a conversation this week (stalled, risk triggers). */
  attention: string[]
  goodNews: string[]
  /** Strong-fit roles posted in the last 7 days the client hasn't already tracked. */
  newJobs: DigestJob[]
  fullViewPath: string
}

export interface CoachWeeklyDigest {
  /** Clients who have shared their profile with this coach, needs-attention first. */
  clients: DigestClient[]
  /** Assigned clients who have not yet consented — name only, no detail. */
  notSharedNames: string[]
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

// Strong-fit board roles posted in the last week, minus anything the client
// is already tracking or has already applied to. Same fit gate as the
// client's own fresh-job alert (isVeryStrongBoardFitFor), so a coach sees what
// the client sees — nothing looser.
async function findNewStrongFitJobs(
  candidateId: string,
  candidate: Parameters<typeof loadBoardShortlist>[0]['candidate']
): Promise<DigestJob[]> {
  const [dossier, tracked] = await Promise.all([
    isDossierUnlocked(candidateId),
    prisma.jobPosting.findMany({ where: { candidateId, url: { not: null } }, select: { url: true } }),
  ])
  const trackedUrls = new Set(tracked.map((t) => normalizeUrl(t.url)).filter((u): u is string => !!u))
  // An email: stays on the pre-v2 fit scoring until FIT_SCORING_V2_FOR_EMAILS is on.
  const fitScoring = emailFitScoringVersion()
  const board = await loadBoardShortlist({
    candidate,
    isCandidatePlus: dossier.unlocked,
    where: postedWithinWhere(WINDOW_DAYS * 24),
    size: SHORTLIST_SIZE,
    fitScoring,
  })
  return board.open
    .filter((p) => !trackedUrls.has(normalizeUrl(p.url) ?? ''))
    .filter((p) => isVeryStrongBoardFitFor(fitScoring, candidate, p, candidateScaleLevel(p.level)))
    .slice(0, MAX_JOBS_PER_CLIENT)
    .map((p) => ({
      title: p.title,
      company: p.disclosure === 'CONFIDENTIAL' ? 'Confidential search' : (p.companyName ?? 'Company not listed'),
      location: p.location,
      postedAgo: postedAgo(p),
      url: p.url,
    }))
}

export async function buildCoachWeeklyDigest(coachId: string, accessToken: string): Promise<CoachWeeklyDigest> {
  const [caseload, profiles] = await Promise.all([
    getCoachCaseload(coachId),
    prisma.candidateProfile.findMany({ where: { coachId } }),
  ])
  const profileById = new Map(profiles.map((p) => [p.id, p]))
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const notSharedNames: string[] = []
  const clients: DigestClient[] = []

  await Promise.all(
    caseload.map(async (entry) => {
      const profile = profileById.get(entry.id)
      // Same gate as the Full Client View: being assigned is not consent.
      if (!profile || profile.coachDossierConsentedAt === null) {
        notSharedNames.push(entry.name)
        return
      }
      const [outcomes, newJobs] = await Promise.all([
        getWeeklyOutcomes(entry.id, since),
        findNewStrongFitJobs(entry.id, profile),
      ])
      const risks = entry.triggers.filter((t) => t.type === 'RISK')
      const attention = [...(entry.isStalled ? ['Search has stalled — no recent activity'] : []), ...risks.map((t) => t.label)]
      clients.push({
        id: entry.id,
        name: entry.name,
        firstName: profile.firstName || entry.name.split(' ')[0],
        weekNumber: entry.weekNumber,
        grade: entry.executionGrade,
        trend: entry.trend,
        mood: entry.sentimentLabel,
        moodTrend: entry.sentimentTrend,
        applications: outcomes.applicationsCount,
        interviews: outcomes.interviewsLandedCount,
        offers: outcomes.offersReceivedCount,
        outreach: outcomes.outreachCount,
        followUpsOwed: outcomes.followUpsPendingCount,
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
    })
  )

  clients.sort((a, b) => b.attention.length - a.attention.length || a.name.localeCompare(b.name))
  notSharedNames.sort()
  return { clients, notSharedNames }
}
