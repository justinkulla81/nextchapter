import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { loadBoardShortlist, postedWithinWhere } from '@/lib/jobs/board-shortlist'
import { emailSafeJobs, midLevelInEmails } from '@/lib/jobs/mid-level'
import { emailFitScoringVersion, isVeryStrongBoardFitFor } from '@/lib/jobs/email-fit-scoring'
import { candidateScaleLevel } from '@/lib/jobs/job-seniority'
import { postedAgo } from '@/lib/jobs/competition'
import { neutralizeEmailSubject } from '@/lib/email/neutral-subject'
import { captureServerEvent } from '@/lib/posthog/server'
import FreshJobAlertEmail from '@/emails/fresh-job-alert'
import { candidateUnsubscribeUrl } from '@/lib/email/signed-links'

/**
 * Instant new-job alerts: when a strong-fit job is posted, email the member
 * the same day so they can apply in the first 72 hours.
 *
 * Switched on by FRESH_JOB_ALERTS_ENABLED=true (founder approved 2026-10-10,
 * on condition that only very strong fits are sent — see
 * isVeryStrongBoardFitFor). While off, the cron only counts who would get one.
 *
 * Rules: at most one alert per member per day; only very strong fits
 * posted in the last 24 hours; at most 2 jobs; never a job already sent in an alert or
 * already shown in Job Search Daily; members who opted out of these alerts,
 * Job Search Daily, or are on a break don't get them.
 */

const MAX_JOBS = 2
const WINDOW_HOURS = 24

export function freshJobAlertsEnabled(): boolean {
  return process.env.FRESH_JOB_ALERTS_ENABLED === 'true'
}

type AlertResult = { sent: boolean; reason: string; jobCount: number }

export async function sendFreshJobAlert(candidateId: string, options: { dryRun?: boolean } = {}): Promise<AlertResult> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } })
  const dayAgo = new Date(Date.now() - 86_400_000)
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
    // Mid-level jobs stay out of emails until the owner turns on MID_LEVEL_IN_EMAILS.
    includeMidLevel: midLevelInEmails(),
  })
  const [alerted, shownDaily] = await Promise.all([
    prisma.freshJobAlertSend.findMany({ where: { candidateId }, select: { postingId: true } }),
    prisma.jobSearchDailyItem.findMany({ where: { candidateId, itemKey: { startsWith: 'job:' } }, select: { itemKey: true } }),
  ])
  const skip = new Set([...alerted.map((a) => a.postingId), ...shownDaily.map((d) => d.itemKey.slice(4))])
  const jobs = emailSafeJobs(board.open)
    .filter((p) => !skip.has(p.id) && isVeryStrongBoardFitFor(fitScoring, candidate, p, candidateScaleLevel(p.level)))
    .slice(0, MAX_JOBS)
  if (jobs.length === 0) return { sent: false, reason: 'no new strong fits', jobCount: 0 }
  if (options.dryRun || !freshJobAlertsEnabled()) return { sent: false, reason: 'dry run', jobCount: jobs.length }
  if (!process.env.RESEND_API_KEY) return { sent: false, reason: 'no RESEND_API_KEY', jobCount: jobs.length }

  const { data: userData } = await createAdminClient().auth.admin.getUserById(candidate.userId)
  const to = userData.user?.email
  if (!to) return { sent: false, reason: 'no email', jobCount: jobs.length }

  // Claim the jobs first so a retry or overlapping run can't double-send.
  await prisma.freshJobAlertSend.createMany({
    data: jobs.map((p) => ({ candidateId, postingId: p.id })),
    skipDuplicates: true,
  })

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
      jobs: jobs.map((p) => ({
        title: p.title,
        company: p.disclosure === 'CONFIDENTIAL' ? 'Confidential search' : p.companyName,
        location: p.location,
        postedAgo: postedAgo(p),
      })),
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
