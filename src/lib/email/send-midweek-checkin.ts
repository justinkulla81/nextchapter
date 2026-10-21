import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { getVictoriaName } from '@/lib/victoria'
import { getTodaysPrimaryAction } from '@/lib/daily/primary-action'
import { generateDailyInsights } from '@/lib/emails/generate-insights'
import { buildWeeklyRecap } from '@/lib/email/weekly-recap'
import { isQuietCandidate } from '@/lib/email/is-quiet-candidate'
import { recordCandidateEmailSent, trackEmailSent } from '@/lib/email/send-log'
import { buildEmailClickUrl } from '@/lib/email/click-link'
import type { WeeklyGap } from '@/lib/email/weekly-gap'
import { neutralizeEmailSubject } from '@/lib/email/neutral-subject'
import MidweekCheckinEmail from '@/emails/midweek-checkin'
import { candidateUnsubscribeUrl } from '@/lib/email/signed-links'

interface Strength {
  title: string
  detail: string
}

export async function sendMidweekCheckin(candidateId: string, introCopy?: string | null, gap: WeeklyGap | null = null) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping Midweek Check-in email.')
    return { sent: false as const }
  }

  try {
    const [candidate, report] = await Promise.all([
      prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } }),
      prisma.marketRealityReport.findFirst({ where: { candidateId }, orderBy: { generatedAt: 'desc' } }),
    ])

    const admin = createAdminClient()
    const { data: userData } = await admin.auth.admin.getUserById(candidate.userId)
    const email = userData.user?.email
    if (!email) return { sent: false as const }

    const victoriaName = getVictoriaName('daily-email')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const unsubscribeUrl = candidateUnsubscribeUrl(appUrl, candidate.id, 'daily')

    const isReset = await isQuietCandidate(candidate)

    // Reset emails still name the task — "do one small thing" with no thing
    // named gives a quiet candidate nothing to act on.
    const primaryAction = report
      ? getTodaysPrimaryAction(
          report.actionPlan as unknown as Parameters<typeof getTodaysPrimaryAction>[0],
          report.generatedAt
        )
      : null

    const insights = !isReset
      ? await generateDailyInsights({
          firstName: candidate.firstName,
          currentStreak: candidate.currentStreak,
          primaryActionText: primaryAction?.text ?? null,
          targetFunction: candidate.targetFunction ?? candidate.targetRoleType ?? null,
          opportunity: report ? ((report.weaknesses as unknown as Strength[])[0] ?? null) : null,
        })
      : null

    // Behind this week's target: lead with the number (the retired Friday "Close the Gap" email).
    const gapSubject =
      gap && !isReset
        ? `${gap.pointsToGo} points from an A this week${candidate.firstName ? `, ${candidate.firstName}` : ''}`
        : null

    const subject = neutralizeEmailSubject(
      gapSubject ??
        insights?.subject ??
        (isReset && primaryAction
          ? `${candidate.firstName ? `${candidate.firstName}, let's` : "Let's"} get started — one 5-minute step`
          : null) ?? (candidate.firstName ? `Midweek check-in, ${candidate.firstName}.` : 'Midweek check-in'),
      candidate.confidentialSearchMode
    )

    const weeklyRecap = !isReset ? await buildWeeklyRecap(candidateId) : null

    const resend = createResend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      replyTo: 'support@launchyournextchapter.com',
      to: email,
      subject,
      react: MidweekCheckinEmail({
        firstName: candidate.firstName,
        victoriaName,
        introCopy: introCopy ?? null,
        isReset,
        resetTask: isReset ? (primaryAction?.text ?? null) : null,
        bullets: insights?.bullets ?? null,
        weeklyRecap,
        gap,
        dashboardUrl: buildEmailClickUrl(appUrl, candidate.id, 'MIDWEEK_CHECKIN', `${appUrl}/dashboard`),
        appUrl,
        unsubscribeUrl,
      }),
    })

    if (error) {
      console.error('Failed to send Midweek Check-in email:', error)
      return { sent: false as const }
    }

    await recordCandidateEmailSent(candidateId, 'MIDWEEK_CHECKIN')
    trackEmailSent(candidateId, 'MIDWEEK_CHECKIN')
    await prisma.candidateProfile.update({ where: { id: candidateId }, data: { lastDailyEmailSentAt: new Date() } })

    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send Midweek Check-in email:', error)
    return { sent: false as const }
  }
}
