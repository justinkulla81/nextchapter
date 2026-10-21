// The weekly "what changed" note (src/lib/reports/market-reality-brief/weekly-change.ts).
// Sent by the weekly-read cron only when something actually moved. The bounds are the same as
// every other recurring candidate email: not for opted-out members, not for the MINIMAL
// notification tier (the cron filters both before calling this).
import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { createAdminClient } from '@/lib/supabase/admin'
import WeeklyReadEmail from '@/emails/weekly-read'
import { candidateUnsubscribeUrl } from '@/lib/email/signed-links'
import type { WeeklyChange } from '@/lib/reports/market-reality-brief/weekly-change'

export async function sendWeeklyReadEmail(
  candidate: { id: string; userId: string; firstName: string | null },
  change: WeeklyChange,
  next: { title: string; href: string } | null
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping weekly read email.')
    return { sent: false as const }
  }
  const admin = createAdminClient()
  const { data: userData } = await admin.auth.admin.getUserById(candidate.userId)
  const email = userData.user?.email
  if (!email) return { sent: false as const }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const lines = [
    ...change.moves.slice(0, 5).map((m) => m.line),
    ...(change.market ? [change.market] : []),
    ...(change.activity ? [change.activity] : []),
    ...(change.grade ? [`Your Market Reality Grade moved from ${change.grade.from} to ${change.grade.to}.`] : []),
    ...(change.inputsKnown ? [`We now know ${change.inputsKnown.to} of ${change.inputsKnown.total} inputs, up from ${change.inputsKnown.from}.`] : []),
  ]

  const resend = createResend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to: email,
    subject: change.headline.replace(/\.$/, ''),
    react: WeeklyReadEmail({
      firstName: candidate.firstName,
      headline: change.headline,
      lines,
      next: next ? { title: next.title, url: `${appUrl}${next.href.startsWith('/') ? next.href : '/dashboard/market-reality'}` } : null,
      reportUrl: `${appUrl}/dashboard/market-reality`,
      unsubscribeUrl: candidateUnsubscribeUrl(appUrl, candidate.id, 'weekly'),
    }),
  })
  if (error) {
    console.error('Failed to send weekly read email:', error)
    return { sent: false as const }
  }
  return { sent: true as const }
}
