import 'server-only'
<<<<<<< HEAD
import { createResend } from '@/lib/email/resend-client'
import MarketDigestCoachEmail from '@/emails/market-digest-coach'
=======
import { Resend } from 'resend'
import MarketDigestCoachEmail, { coachDigestSummary } from '@/emails/market-digest-coach'
import type { CoachWeeklyDigest } from '@/lib/coach/weekly-digest'
>>>>>>> 186c3ee5 (Coach weekly digest: per-client sections with their week, flags and new strong-fit roles)
import { digestClickUrl } from '@/lib/email/digest-click-url'

export async function sendMarketDigestCoachEmail(
  coach: { id: string; fullName: string; workEmail: string; accessToken: string },
  digest: CoachWeeklyDigest,
  roleLines: { roleType: string; adzunaCount: number | null }[],
  nugget: { id: string; title: string | null; url: string; summary: string | null } | null
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping coach market digest email.')
    return { sent: false as const }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  // The digest shows each consented client's week and new roles; the button
  // takes the coach to the full caseload.
  const caseloadUrl = `${appUrl}/support/coach/caseload/${coach.accessToken}`
  const unsubscribeUrl = `${appUrl}/api/unsubscribe/audience/coach/${coach.id}`

<<<<<<< HEAD
  const resend = createResend(process.env.RESEND_API_KEY)
=======
  const clients = digest.clients.map((c) => ({
    ...c,
    fullViewUrl: `${appUrl}${c.fullViewPath}`,
  }))
  const summary = coachDigestSummary(clients)
  const subject =
    clients.length === 0
      ? 'Your weekly market update'
      : summary.needAttention > 0
        ? `${summary.needAttention} of your clients ${summary.needAttention === 1 ? 'needs' : 'need'} a conversation, ${summary.newRoles} new role${summary.newRoles === 1 ? '' : 's'} to send`
        : `Your clients this week: ${summary.newRoles} new role${summary.newRoles === 1 ? '' : 's'} to send`

  const resend = new Resend(process.env.RESEND_API_KEY)
>>>>>>> 186c3ee5 (Coach weekly digest: per-client sections with their week, flags and new strong-fit roles)
  const { error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to: coach.workEmail,
    subject,
    react: MarketDigestCoachEmail({
      fullName: coach.fullName,
      clients,
      notSharedNames: digest.notSharedNames,
      roleLines,
      nuggetTitle: nugget?.title ?? null,
      nuggetUrl: nugget ? digestClickUrl('coach', coach.id, nugget.id) : null,
      nuggetSummary: nugget?.summary ?? null,
      caseloadUrl,
      unsubscribeUrl,
    }),
  })

  if (error) {
    console.error('Failed to send coach market digest email:', error)
    return { sent: false as const }
  }

  return { sent: true as const }
}
