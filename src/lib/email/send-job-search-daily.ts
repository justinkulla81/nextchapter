import 'server-only'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordCandidateEmailSent } from '@/lib/email/send-log'
import { neutralizeEmailSubject } from '@/lib/email/neutral-subject'
import { captureServerEvent } from '@/lib/posthog/server'
import {
  buildJobSearchDaily,
  shownItemKeys,
  rotatingItemKeys,
  hasSomethingToSay,
  type JobSearchDailyContent,
} from '@/lib/job-search-daily/build'
import JobSearchDailyEmail from '@/emails/job-search-daily'

type SendResult = { sent: true } | { sent: false; reason: string }

// The subject leads with the single freshest thing in the email, so the
// inbox line itself is different every day instead of a fixed title.
function buildSubject(content: JobSearchDailyContent): string {
  const jobs = content.jobs.items.length
  const move = content.companyMoves[0]
  const owed = content.applications.length + content.networking.length
  // Lead with the most time-sensitive thing, when there is one.
  const top = content.priorities[0]
  if (
    top &&
    /^(Today|Tomorrow|Overdue|Waiting|Reply today|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/.test(
      top.lead
    )
  )
    return `${top.lead.replace(/:$/, '')}: ${top.text}`.slice(0, 90)
  if (jobs > 0 && move) return `${jobs} new role${jobs === 1 ? '' : 's'} for you, and ${lowerFirst(move.title)}`
  if (jobs > 0) return `${jobs} new role${jobs === 1 ? '' : 's'} that fit you`
  if (move) return move.title
  if (content.score?.status === 'locked') return "Your A is locked in. Here's today"
  if (owed > 0) return `${owed} follow-up${owed === 1 ? '' : 's'} for today`
  if (content.todos.length > 0) return 'Your to-dos for today'
  return 'Your day, in one minute'
}

function lowerFirst(s: string): string {
  // Company names lead most titles, so only lowercase a leading common word.
  return /^(Your|A|The)\b/.test(s) ? s[0].toLowerCase() + s.slice(1) : s
}

export async function sendJobSearchDaily(candidateId: string, options: { dryRun?: boolean; toOverride?: string } = {}) {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
  })
  const now = new Date()
  const content = await buildJobSearchDaily(candidate, now)

  // No fluff: with nothing new and nothing to do, skip the day rather than
  // send a line and a score.
  if (!hasSomethingToSay(content)) {
    return { sent: false, reason: 'nothing new', content } as SendResult & {
      content: JobSearchDailyContent
    }
  }

  const subject = neutralizeEmailSubject(buildSubject(content), candidate.confidentialSearchMode)
  if (options.dryRun) return { sent: false, reason: 'dry run', content, subject }

  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping Job Search Daily.')
    return { sent: false, reason: 'no RESEND_API_KEY' } as SendResult
  }

  let to = options.toOverride
  if (!to) {
    const admin = createAdminClient()
    const { data: userData } = await admin.auth.admin.getUserById(candidate.userId)
    to = userData.user?.email ?? undefined
  }
  if (!to) return { sent: false, reason: 'no email' } as SendResult

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const weekday = now.toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'America/New_York',
  })

  // Claim the day before sending (same idempotency as the weekday
  // rotation) — a test send to an override address doesn't claim it.
  if (!options.toOverride && !(await recordCandidateEmailSent(candidateId, 'JOB_SEARCH_DAILY'))) {
    return { sent: false, reason: 'already sent today' } as SendResult
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data: sendData, error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to,
    subject,
    react: JobSearchDailyEmail({
      content,
      masthead: candidate.confidentialSearchMode ? 'NextChapter Daily' : 'Job Search Daily',
      weekday,
      appUrl,
      unsubscribeUrl: `${appUrl}/api/unsubscribe/${candidate.id}?type=jobSearchDaily`,
    }),
  })

  if (error) {
    console.error('Failed to send Job Search Daily:', error)
    if (!options.toOverride) {
      // Release the claim so a retry the same day can still send.
      await prisma.candidateEmailSendLog
        .deleteMany({
          where: {
            candidateId,
            emailKey: 'JOB_SEARCH_DAILY',
            sentAt: { gte: now },
          },
        })
        .catch(() => {})
    }
    return { sent: false, reason: 'send failed' } as SendResult
  }

  if (!options.toOverride) {
    // Keyed by Resend's email id so the webhook can attribute delivery,
    // opens and clicks to this candidate (see applyResendEvent).
    if (sendData?.id) {
      await prisma.jobSearchDailySend
        .create({ data: { candidateId, resendEmailId: sendData.id } })
        .catch((e) => console.error('Failed to record Job Search Daily send:', e))
    }
    const keys = shownItemKeys(content)
    await prisma.jobSearchDailyItem.createMany({
      data: keys.map((itemKey) => ({ candidateId, itemKey })),
      skipDuplicates: true,
    })
    // Unlock nudges and quotes come back around after their repeat
    // window, so their row already exists the second time — bump shownAt
    // to restart the window.
    await prisma.jobSearchDailyItem.updateMany({
      where: { candidateId, itemKey: { in: rotatingItemKeys(content) } },
      data: { shownAt: now },
    })
    captureServerEvent(candidateId, 'job_search_daily_sent', {
      scoreStatus: content.score?.status ?? null,
      priorityCount: content.priorities.length,
      topPriorityLead: content.priorities[0]?.lead ?? null,
      staleApplicationCount: content.staleApplicationCount,
      todoCount: content.todos.length,
      applicationFollowUpCount: content.applications.length,
      networkingFollowUpCount: content.networking.length,
      jobCount: content.jobs.items.length,
      lockedJobCount: content.jobs.lockedCount,
      companyMoveCount: content.companyMoves.length,
      hasReconnect: !!content.reconnect,
      hasArticle: !!content.article,
      unlockId: content.unlock?.key ?? null,
      actionLabel: content.action.label,
      quoteId: content.quote?.id ?? null,
      freshCount: content.freshCount,
    })
  }

  return { sent: true } as SendResult
}
