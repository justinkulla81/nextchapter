import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { createAdminClient } from '@/lib/supabase/admin'
import MarketDigestCandidateEmail from '@/emails/market-digest-candidate'
import type { MarketConditions } from '@/lib/market/types'
import { recordCandidateEmailSent, trackEmailSent } from '@/lib/email/send-log'
import { buildEmailClickUrl } from '@/lib/email/click-link'
import { digestClickUrl } from '@/lib/email/digest-click-url'
import { audienceUnsubscribeUrl } from '@/lib/email/signed-links'
import { prisma } from '@/lib/prisma'
import { aiMarketLine } from '@/lib/skills/ai-skill-market'

export async function sendMarketDigestCandidateEmail(
  candidate: { id: string; userId: string; firstName: string | null },
  marketConditions: MarketConditions,
  nugget: { id: string; title: string | null; url: string; summary: string | null } | null,
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

  // The one AI line, for the member's own function (static analysis, no cost). Never blocks the send.
  const fnRow = await prisma.candidateProfile.findUnique({ where: { id: candidate.id }, select: { primaryFunction: true } }).catch(() => null)
  const aiMarketText = aiMarketLine(fnRow?.primaryFunction)?.text ?? null

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const dashboardUrl = buildEmailClickUrl(appUrl, candidate.id, 'MARKET_UPDATE', `${appUrl}/dashboard`)
  const unsubscribeUrl = audienceUnsubscribeUrl(appUrl, 'candidate', candidate.id)

  const resend = createResend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to: email,
    subject: candidate.firstName ? `Your market update, ${candidate.firstName}` : 'Your market update',
    react: MarketDigestCandidateEmail({
      firstName: candidate.firstName,
      introCopy: introCopy ?? null,
      adzunaCount: marketConditions.adzunaCount,
      adzunaIdealCount: marketConditions.adzunaIdealCount,
      blsYoyChangePct: marketConditions.blsYoyChangePct,
      nuggetTitle: nugget?.title ?? null,
      nuggetUrl: nugget ? digestClickUrl('candidate', candidate.id, nugget.id) : null,
      nuggetSummary: nugget?.summary ?? null,
      aiMarketText,
      dashboardUrl,
      unsubscribeUrl,
    }),
  })

  if (error) {
    console.error('Failed to send candidate market digest email:', error)
    return { sent: false as const }
  }

  await recordCandidateEmailSent(candidate.id, 'MARKET_UPDATE')
  trackEmailSent(candidate.id, 'MARKET_UPDATE')

  return { sent: true as const }
}
