import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordCandidateEmailSent } from '@/lib/email/send-log'
import { candidateUnsubscribeUrl } from '@/lib/email/signed-links'
import WinBackEmail from '@/emails/win-back'
import { winBackContent, type WinBackStep } from '@/lib/winback/sequence'
import { effectiveJourney } from '@/lib/journey/journey'
import { captureServerEvent } from '@/lib/posthog/server'

export async function sendWinBackEmail(candidateId: string, step: WinBackStep) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping win-back email.')
    return { sent: false as const }
  }
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } })
  const { data } = await createAdminClient().auth.admin.getUserById(candidate.userId)
  const email = data.user?.email
  if (!email) return { sent: false as const }

  // Claim first: a duplicate cron fire cannot send twice in a day.
  if (!(await recordCandidateEmailSent(candidateId, 'WIN_BACK'))) return { sent: false as const }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const journey = effectiveJourney(candidate) ?? 'EXPLORING_MOVE'
  const content = winBackContent(step, candidate.firstName, journey)
  const ctaUrl = step === 2 ? `${appUrl}/dashboard/privacy` : `${appUrl}/dashboard`
  const { error } = await createResend(process.env.RESEND_API_KEY).emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to: email,
    subject: content.subject,
    react: WinBackEmail({ content, ctaUrl, unsubscribeUrl: candidateUnsubscribeUrl(appUrl, candidate.id, 'weekly') }),
  })
  if (error) {
    console.error('Failed to send win-back email:', error)
    // Release the claim so the next run can try again.
    await prisma.candidateEmailSendLog.deleteMany({ where: { candidateId, emailKey: 'WIN_BACK', sentForDate: { gte: new Date(Date.now() - 86_400_000) } } }).catch(() => {})
    return { sent: false as const }
  }
  captureServerEvent(candidateId, 'win_back_emailed', { candidateId, step, journey })
  return { sent: true as const }
}
