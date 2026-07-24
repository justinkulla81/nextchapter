import 'server-only'
import { Resend } from 'resend'
import MarketDigestCoachEmail from '@/emails/market-digest-coach'

export async function sendMarketDigestCoachEmail(
  coach: { id: string; fullName: string; workEmail: string },
  roleLines: { roleType: string; adzunaCount: number | null }[],
  nugget: { title: string | null; url: string; summary: string | null } | null
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping coach market digest email.')
    return { sent: false as const }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const portalUrl = `${appUrl}/support/coach`
  const unsubscribeUrl = `${appUrl}/api/unsubscribe/audience/coach/${coach.id}`

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to: coach.workEmail,
    subject: 'Your caseload market update',
    react: MarketDigestCoachEmail({
      fullName: coach.fullName,
      roleLines,
      nuggetTitle: nugget?.title ?? null,
      nuggetUrl: nugget?.url ?? null,
      nuggetSummary: nugget?.summary ?? null,
      portalUrl,
      unsubscribeUrl,
    }),
  })

  if (error) {
    console.error('Failed to send coach market digest email:', error)
    return { sent: false as const }
  }

  return { sent: true as const }
}
