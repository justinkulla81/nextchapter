import 'server-only'
import { Resend } from 'resend'
import MarketDigestRecruiterEmail from '@/emails/market-digest-recruiter'
import type { MarketConditions } from '@/lib/market/types'

export async function sendMarketDigestRecruiterEmail(
  recruiter: { id: string; fullName: string; workEmail: string; specialty: string | null },
  marketConditions: MarketConditions | null,
  nugget: { title: string | null; url: string; summary: string | null } | null
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping recruiter market digest email.')
    return { sent: false as const }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const portalUrl = `${appUrl}/recruiters/dashboard`
  const unsubscribeUrl = `${appUrl}/api/unsubscribe/recruiter/${recruiter.id}`

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to: recruiter.workEmail,
    subject: 'Your market update',
    react: MarketDigestRecruiterEmail({
      fullName: recruiter.fullName,
      specialty: recruiter.specialty,
      adzunaCount: marketConditions?.adzunaCount ?? null,
      blsYoyChangePct: marketConditions?.blsYoyChangePct ?? null,
      nuggetTitle: nugget?.title ?? null,
      nuggetUrl: nugget?.url ?? null,
      nuggetSummary: nugget?.summary ?? null,
      portalUrl,
      unsubscribeUrl,
    }),
  })

  if (error) {
    console.error('Failed to send recruiter market digest email:', error)
    return { sent: false as const }
  }

  return { sent: true as const }
}
