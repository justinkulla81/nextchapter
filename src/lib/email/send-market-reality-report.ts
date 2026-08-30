import 'server-only'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import MarketRealityReportEmail from '@/emails/market-reality-report'

// justEarnedBadge folds a "you also just earned the Market Reality
// Assessment badge" line into this same email instead of sending it as a
// separate badge-earned email seconds apart — see MILESTONE_BADGE_KEYS_WITHOUT_OWN_EMAIL
// in badge-notifications.ts. Only get-dashboard-data.ts's justRegistered
// call site passes true — that's the one place this email and the badge are
// guaranteed to be earned in the very same request. The dashboard/page.tsx
// catch-up call (resolveLatestReport, for a report whose registration-time
// send got cut off) omits it, since by then the badge moment has passed.
export async function sendMarketRealityReportEmail(candidateId: string, options?: { justEarnedBadge?: boolean }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping market reality report email.')
    return { sent: false as const }
  }

  try {
    const [candidate, report] = await Promise.all([
      prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } }),
      prisma.marketRealityReport.findFirst({
        where: { candidateId },
        orderBy: { generatedAt: 'desc' },
      }),
    ])

    if (!report) return { sent: false as const }

    // Atomically claim the send so two concurrent callers (e.g. two
    // near-simultaneous /dashboard loads both resolving the same unsent
    // report) can't both pass the "not yet sent" check and each send an
    // email — the WHERE clause below is evaluated atomically by Postgres.
    const claimed = await prisma.marketRealityReport.updateMany({
      where: { id: report.id, emailSentAt: null },
      data: { emailSentAt: new Date() },
    })
    if (claimed.count === 0) return { sent: false as const }

    const admin = createAdminClient()
    const { data: userData } = await admin.auth.admin.getUserById(candidate.userId)
    const email = userData.user?.email
    if (!email) return { sent: false as const }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const firstName = candidate.firstName || candidate.displayName || 'there'

    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      replyTo: 'support@launchyournextchapter.com',
      to: email,
      subject: options?.justEarnedBadge
        ? `You earned a badge, and your Market Reality Grade is ready, ${firstName}`
        : `Your Market Reality Grade is ready, ${firstName}`,
      react: MarketRealityReportEmail({
        candidateName: firstName,
        reportUrl: `${appUrl}/dashboard/market-reality`,
        justEarnedBadge: !!options?.justEarnedBadge,
      }),
    })

    if (error) {
      console.error('Failed to send market reality report email:', error)
      // Release the claim so a later attempt can retry the send.
      await prisma.marketRealityReport.update({
        where: { id: report.id },
        data: { emailSentAt: null },
      })
      return { sent: false as const }
    }

    return { sent: true as const }
  } catch (error) {
    // Email delivery must never break report generation.
    console.error('Failed to send market reality report email:', error)
    return { sent: false as const }
  }
}
