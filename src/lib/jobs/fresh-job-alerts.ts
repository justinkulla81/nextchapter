import 'server-only'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { loadBoardShortlist, postedWithinWhere } from '@/lib/jobs/board-shortlist'
import { computeBoardListingFitBucket } from '@/lib/jobs/job-fit-bucket'
import { postedAgo } from '@/lib/jobs/competition'
import { neutralizeEmailSubject } from '@/lib/email/neutral-subject'
import { captureServerEvent } from '@/lib/posthog/server'
import FreshJobAlertEmail from '@/emails/fresh-job-alert'

/**
 * Instant new-job alerts: when a strong-fit job is posted, email the member
 * the same day so they can apply in the first 72 hours.
 *
 * OFF until FRESH_JOB_ALERTS_ENABLED=true (a new kind of member email, held
 * for the founder's sign-off on wording and frequency). While off, the cron
 * only counts who would get one.
 *
 * Rules: at most one alert per member per day; only 'strong' fits posted in
 * the last 24 hours; at most 3 jobs; never a job already sent in an alert or
 * already shown in Job Search Daily; members who opted out of these alerts,
 * Job Search Daily, or are on a break don't get them.
 */

const MAX_JOBS = 3
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
  const board = await loadBoardShortlist({
    candidate,
    isCandidatePlus: dossier.unlocked,
    where: postedWithinWhere(WINDOW_HOURS),
    size: 30,
  })
  const [alerted, shownDaily] = await Promise.all([
    prisma.freshJobAlertSend.findMany({ where: { candidateId }, select: { postingId: true } }),
    prisma.jobSearchDailyItem.findMany({ where: { candidateId, itemKey: { startsWith: 'job:' } }, select: { itemKey: true } }),
  ])
  const skip = new Set([...alerted.map((a) => a.postingId), ...shownDaily.map((d) => d.itemKey.slice(4))])
  const jobs = board.open
    .filter((p) => !skip.has(p.id) && computeBoardListingFitBucket(candidate, p) === 'strong')
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
  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
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
      unsubscribeUrl: `${appUrl}/api/unsubscribe/${candidate.id}?type=freshJobAlerts`,
    }),
  })
  if (error) {
    await prisma.freshJobAlertSend.deleteMany({ where: { candidateId, postingId: { in: jobs.map((p) => p.id) } } })
    return { sent: false, reason: 'send failed', jobCount: jobs.length }
  }
  captureServerEvent(candidateId, 'fresh_job_alert_sent', { jobCount: jobs.length, postingIds: jobs.map((p) => p.id) })
  return { sent: true, reason: 'sent', jobCount: jobs.length }
}
