import 'server-only'
import { Resend } from 'resend'
import MarketDigestCoachEmail from '@/emails/market-digest-coach'
import { digestClickUrl } from '@/lib/email/digest-click-url'

export async function sendMarketDigestCoachEmail(
  coach: { id: string; fullName: string; workEmail: string; accessToken: string },
  roleLines: { roleType: string; adzunaCount: number | null }[],
  nugget: { id: string; title: string | null; url: string; summary: string | null } | null
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping coach market digest email.')
    return { sent: false as const }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  // The coach's caseload is their list of clients (CaseloadEntry, see
  // src/lib/coach/caseload.ts) — this digest is job-market data about
  // those clients' target roles, not the caseload itself, so the button
  // takes them to the real caseload page rather than claiming to be it.
  const caseloadUrl = `${appUrl}/support/coach/caseload/${coach.accessToken}`
  const unsubscribeUrl = `${appUrl}/api/unsubscribe/audience/coach/${coach.id}`

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to: coach.workEmail,
    subject: 'Your weekly market update',
    react: MarketDigestCoachEmail({
      fullName: coach.fullName,
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
