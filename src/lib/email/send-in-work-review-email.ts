import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { neutralizeEmailSubject } from '@/lib/email/neutral-subject'
import { captureServerEvent } from '@/lib/posthog/server'
import { buildReviewEmailContent } from '@/lib/in-work/outreach'
import type { OutreachDecision } from '@/lib/in-work/review-schedule'
import InWorkReviewEmail from '@/emails/in-work-review'
import { candidateUnsubscribeUrl } from '@/lib/email/signed-links'

type SendResult = { sent: true } | { sent: false; reason: string }

// One review-cycle email (PREPARE or RESPOND) to one member. The caller has
// already decided WHO and WHICH (decideOutreach) and checked the flag and
// the volume guard. This claims the (member, cycle, kind) row before sending,
// so a duplicate cron fire cannot double send, and releases the claim if the
// send fails so a retry the same day still works.
export async function sendInWorkReviewEmail(
  candidateId: string,
  decision: OutreachDecision,
  options: { toOverride?: string } = {},
): Promise<SendResult> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set, skipping in-work review email.')
    return { sent: false, reason: 'no RESEND_API_KEY' }
  }

  const [candidate, winCount, lastOutcome] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: { id: true, userId: true, firstName: true, confidentialSearchMode: true },
    }),
    prisma.inWorkWin.count({ where: { candidateId } }),
    prisma.inWorkOutcome.findFirst({ where: { candidateId }, orderBy: { reviewedOn: 'desc' }, select: { followUps: true } }),
  ])

  let to = options.toOverride
  if (!to) {
    const admin = createAdminClient()
    const { data } = await admin.auth.admin.getUserById(candidate.userId)
    to = data.user?.email ?? undefined
  }
  if (!to) return { sent: false, reason: 'no email' }

  const openFollowUps = Array.isArray(lastOutcome?.followUps)
    ? (lastOutcome.followUps as { done?: boolean }[]).filter((f) => f && f.done !== true).length
    : 0
  const content = buildReviewEmailContent({
    kind: decision.kind,
    cycle: decision.cycle,
    firstName: candidate.firstName,
    winCount,
    openFollowUps,
  })
  const subject = neutralizeEmailSubject(content.subject, candidate.confidentialSearchMode)

  if (!options.toOverride) {
    try {
      await prisma.inWorkEmailSend.create({
        data: { candidateId, cycleKey: decision.cycle.key, kind: decision.kind },
      })
    } catch {
      // Unique violation: another run already sent this one.
      return { sent: false, reason: 'already sent' }
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const resend = createResend(process.env.RESEND_API_KEY)
  const { data: sendData, error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to,
    subject,
    react: InWorkReviewEmail({
      firstName: candidate.firstName,
      content,
      appUrl,
      unsubscribeUrl: candidateUnsubscribeUrl(appUrl, candidate.id, 'inWork'),
    }),
  })

  if (error) {
    console.error('Failed to send in-work review email:', error)
    if (!options.toOverride) {
      await prisma.inWorkEmailSend
        .deleteMany({ where: { candidateId, cycleKey: decision.cycle.key, kind: decision.kind } })
        .catch(() => {})
    }
    return { sent: false, reason: 'send failed' }
  }

  if (!options.toOverride) {
    if (sendData?.id) {
      await prisma.inWorkEmailSend
        .updateMany({
          where: { candidateId, cycleKey: decision.cycle.key, kind: decision.kind },
          data: { resendEmailId: sendData.id },
        })
        .catch(() => {})
    }
    captureServerEvent(candidateId, 'in_work_review_email_sent', {
      kind: decision.kind,
      cycleKey: decision.cycle.key,
      exactDate: decision.cycle.exact,
    })
  }
  return { sent: true }
}
