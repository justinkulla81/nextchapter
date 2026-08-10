import 'server-only'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import MarketDigestCandidateEmail from '@/emails/market-digest-candidate'
import type { MarketConditions } from '@/lib/market/types'
import { recordCandidateEmailSent } from '@/lib/email/send-log'

export async function sendMarketDigestCandidateEmail(
  candidate: { id: string; userId: string; firstName: string | null },
  marketConditions: MarketConditions,
  nugget: { title: string | null; url: string; summary: string | null } | null,
  introCopy?: string | null
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping candidate market digest email.')
    return { sent: false as const }
  }

  const admin = createAdminClient()
  const { data: userData } = await admin.auth.admin.getUserById(candidate.userId)
  const email = userData.user?.email
  if (!email) return { sent: false as const }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const dashboardUrl = `${appUrl}/dashboard`
  const unsubscribeUrl = `${appUrl}/api/unsubscribe/audience/candidate/${candidate.id}`

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to: email,
    subject: candidate.firstName ? `Your market update, ${candidate.firstName}` : 'Your market update',
    react: MarketDigestCandidateEmail({
      firstName: candidate.firstName,
      introCopy: introCopy ?? null,
      adzunaCount: marketConditions.adzunaCount,
      blsYoyChangePct: marketConditions.blsYoyChangePct,
      nuggetTitle: nugget?.title ?? null,
      nuggetUrl: nugget?.url ?? null,
      nuggetSummary: nugget?.summary ?? null,
      dashboardUrl,
      unsubscribeUrl,
    }),
  })

  if (error) {
    console.error('Failed to send candidate market digest email:', error)
    return { sent: false as const }
  }

  await recordCandidateEmailSent(candidate.id, 'MARKET_UPDATE')

  return { sent: true as const }
}
