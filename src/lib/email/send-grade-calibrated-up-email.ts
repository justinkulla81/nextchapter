// Fired only on a genuine upward band-cross from the calibration loop
// (calibration.ts's runWeeklyCalibrationCheck) — never on a within-band
// nudge. Event-triggered, not part of the CandidateEmailKey daily
// rotation, same precedent as send-backchannel-match.ts/
// send-reference-declined-notice.ts: natural one-shot idempotency already
// comes from the calibration check itself (one check per candidate per
// week, only ever bandCrossed+OVER once per real cross).
import 'server-only'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import GradeCalibratedUpEmail from '@/emails/grade-calibrated-up'
import type { Grade } from '@/lib/scoring/grade'

export async function sendGradeCalibratedUpEmail(
  candidate: { id: string; userId: string; firstName: string | null },
  previousGrade: Grade,
  newGrade: Grade
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping grade-calibrated-up email.')
    return { sent: false as const }
  }

  const admin = createAdminClient()
  const { data: userData } = await admin.auth.admin.getUserById(candidate.userId)
  const email = userData.user?.email
  if (!email) return { sent: false as const }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const marketRealityReportUrl = `${appUrl}/dashboard/market-reality`
  const unsubscribeUrl = `${appUrl}/api/unsubscribe/${candidate.id}?type=weekly`

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to: email,
    subject: 'Your Market Reality grade just moved up',
    react: GradeCalibratedUpEmail({
      firstName: candidate.firstName,
      previousGrade,
      newGrade,
      marketRealityReportUrl,
      unsubscribeUrl,
    }),
  })

  if (error) {
    console.error('Failed to send grade-calibrated-up email:', error)
    return { sent: false as const }
  }

  return { sent: true as const }
}
