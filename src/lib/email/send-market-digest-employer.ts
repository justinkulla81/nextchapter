import 'server-only'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import MarketDigestEmployerEmail from '@/emails/market-digest-employer'

export async function sendMarketDigestEmployerEmail(
  employer: { id: string; userId: string; companyName: string; contactName: string | null },
  matchLines: { displayName: string; roleTitle: string; matchLabel: string; locked: boolean }[],
  nugget: { title: string | null; url: string; summary: string | null } | null
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping employer market digest email.')
    return { sent: false as const }
  }

  const admin = createAdminClient()
  const { data: userData } = await admin.auth.admin.getUserById(employer.userId)
  const email = userData.user?.email
  if (!email) return { sent: false as const }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const portalUrl = `${appUrl}/talent/dashboard`
  const unsubscribeUrl = `${appUrl}/api/unsubscribe/audience/employer/${employer.id}`

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to: email,
    subject: 'Your hiring market update',
    react: MarketDigestEmployerEmail({
      contactName: employer.contactName,
      companyName: employer.companyName,
      matchLines,
      nuggetTitle: nugget?.title ?? null,
      nuggetUrl: nugget?.url ?? null,
      nuggetSummary: nugget?.summary ?? null,
      portalUrl,
      unsubscribeUrl,
    }),
  })

  if (error) {
    console.error('Failed to send employer market digest email:', error)
    return { sent: false as const }
  }

  return { sent: true as const }
}
