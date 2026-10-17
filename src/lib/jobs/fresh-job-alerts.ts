import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { loadBoardShortlist, postedWithinWhere } from '@/lib/jobs/board-shortlist'
import { emailSafeJobs, midLevelInEmails } from '@/lib/jobs/mid-level'
import { earlyCareerInEmails } from '@/lib/jobs/career-stage'
import { classifyWorkType } from '@/lib/jobs/work-type'
import { boardListingFitBucketFor, emailFitScoringVersion, isVeryStrongBoardFitFor } from '@/lib/jobs/email-fit-scoring'
import { candidateScaleLevel } from '@/lib/jobs/job-seniority'
import { neutralizeEmailSubject } from '@/lib/email/neutral-subject'
import { captureServerEvent } from '@/lib/posthog/server'
import FreshJobAlertEmail from '@/emails/fresh-job-alert'
import { candidateUnsubscribeUrl } from '@/lib/email/signed-links'
import { claimFreshJobAlert, FRESH_ALERT_COOLDOWN_MS } from '@/lib/jobs/fresh-job-alert-cap'
import { boardJobCardTexts } from '@/lib/jobs/job-card-server'
import { metaLineText } from '@/lib/jobs/job-card'

/**
 * Instant new-job alerts: when a strong-fit job is posted, email the member
 * the same day so they can apply in the first 72 hours.
 *
 * Switched on by FRESH_JOB_ALERTS_ENABLED=true (founder approved 2026-10-10,
 * on condition that only very strong fits are sent — see
 * isVeryStrongBoardFitFor). While off, the cron only counts who would get one.
 *
 * Runs several times a day (vercel.json), shortly after the crawler's
 * 3-hourly hot-tier imports, so a job reaches the member within hours of
 * posting. The cap still holds: claimFreshJobAlert allows at most one alert
 * per member per rolling 24 hours, even across overlapping runs.
 *
 * Rules: at most one alert per member per day; only very strong fits
 * posted in the last 24 hours; at most 2 jobs; never a job already sent in an alert or
 * already shown in Job Search Daily; members who opted out of these alerts,
 * Job Search Daily, or who are managing their career rather than looking don't get them.
 */

const MAX_JOBS = 2
const WINDOW_HOURS = 24

export function freshJobAlertsEnabled(): boolean {
  return process.env.FRESH_JOB_ALERTS_ENABLED === 'true'
}

type AlertResult = { sent: boolean; reason: string; jobCount: number }

export async function sendFreshJobAlert(candidateId: string, options: { dryRun?: boolean } = {}): Promise<AlertResult> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } })
  const dayAgo = new Date(Date.now() - FRESH_ALERT_COOLDOWN_MS)
  // Cheap early exit; the binding check is the transactional claim below.
  if (await prisma.freshJobAlertSend.findFirst({ where: { candidateId, sentAt: { gte: dayAgo } } })) {
    return { sent: false, reason: 'already alerted today', jobCount: 0 }
  }

  const dossier = await isDossierUnlocked(candidateId)
  // Stays on the pre-v2 fit scoring until the owner turns on
  // FIT_SCORING_V2_FOR_EMAILS (email-fit-scoring.ts).
  const fitScoring = emailFitScoringVersion()
  const board = await loadBoardShortlist({
    candidate,
    isCandidatePlus: dossier.unlocked,
    where: postedWithinWhere(WINDOW_HOURS),
    size: 30,
    fitScoring,
    // A small strict market fills with bridge jobs (labelled) instead of going out near-empty.
    autoWidenTo: 30,
    // Mid-level and early-career jobs stay out of emails until the owner turns on
    // MID_LEVEL_IN_EMAILS / EARLY_CAREER_IN_EMAILS; the member's stage window applies.
    includeMidLevel: midLevelInEmails(),
    includeEarlyCareer: earlyCareerInEmails(),
  })
  const [alerted, shownDaily] = await Promise.all([
    prisma.freshJobAlertSend.findMany({ where: { candidateId }, select: { postingId: true } }),
    prisma.jobSearchDailyItem.findMany({ where: { candidateId, itemKey: { startsWith: 'job:' } }, select: { itemKey: true } }),
  ])
  const skip = new Set([...alerted.map((a) => a.postingId), ...shownDaily.map((d) => d.itemKey.slice(4))])
  let jobs = emailSafeJobs(board.open)
    // Owner's rule (2026-10-15): alerts are full-time only; part-time, contract
    // and advisory roles stay on the board.
    .filter((p) => classifyWorkType(p) === 'full_time')
    .filter((p) => !skip.has(p.id) && isVeryStrongBoardFitFor(fitScoring, candidate, p, candidateScaleLevel(p.level)))
    .slice(0, MAX_JOBS)
  if (jobs.length === 0) return { sent: false, reason: 'no new strong fits', jobCount: 0 }
  if (options.dryRun || !freshJobAlertsEnabled()) return { sent: false, reason: 'dry run', jobCount: jobs.length }
  if (!process.env.RESEND_API_KEY) return { sent: false, reason: 'no RESEND_API_KEY', jobCount: jobs.length }

  const { data: userData } = await createAdminClient().auth.admin.getUserById(candidate.userId)
  const to = userData.user?.email
  if (!to) return { sent: false, reason: 'no email', jobCount: jobs.length }

  // Claim the jobs first (cap re-checked in a Serializable transaction) so a
  // retry or overlapping run can't double-send.
  const claim = await claimFreshJobAlert(prisma, candidateId, jobs.map((p) => p.id))
  if (claim.status === 'cooldown') return { sent: false, reason: 'already alerted today', jobCount: 0 }
  if (claim.status === 'nothing_new') return { sent: false, reason: 'no new strong fits', jobCount: 0 }
  const claimed = new Set(claim.postingIds)
  jobs = jobs.filter((p) => claimed.has(p.id))

  // Each job reads as it does on the board card (job-card.ts): verdict, why line, meta line.
  const cards = boardJobCardTexts({ candidate, shortlist: board, postings: jobs, fitBucketFor: (p) => boardListingFitBucketFor(fitScoring, candidate, p) })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const subject = neutralizeEmailSubject(
    jobs.length === 1 ? `Just posted: ${jobs[0].title}` : `${jobs.length} roles that fit you were just posted`,
    candidate.confidentialSearchMode
  )
  const { error } = await createResend(process.env.RESEND_API_KEY).emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to,
    subject,
    react: FreshJobAlertEmail({
      firstName: candidate.firstName,
      jobs: jobs.map((p) => {
        const card = cards.get(p.id)!
        return {
          title: p.title,
          company: p.disclosure === 'CONFIDENTIAL' ? 'Confidential search' : p.companyName,
          verdict: card.verdictLabel,
          meta: metaLineText(card),
          why: card.whyLine || null,
        }
      }),
      boardUrl: `${appUrl}/dashboard/find-my-job?view=fresh&src=fresh_job_alert#job-recommendations`,
      unsubscribeUrl: candidateUnsubscribeUrl(appUrl, candidate.id, 'freshJobAlerts'),
    }),
  })
  if (error) {
    await prisma.freshJobAlertSend.deleteMany({ where: { candidateId, postingId: { in: jobs.map((p) => p.id) } } })
    return { sent: false, reason: 'send failed', jobCount: jobs.length }
  }
  captureServerEvent(candidateId, 'fresh_job_alert_sent', { jobCount: jobs.length, postingIds: jobs.map((p) => p.id) })
  return { sent: true, reason: 'sent', jobCount: jobs.length }
}
