import 'server-only'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { getVictoriaName } from '@/lib/victoria'
import { getTodaysPrimaryAction } from '@/lib/daily/primary-action'
import { generateDailyInsights } from '@/lib/emails/generate-insights'
import { buildWeeklyRecap } from '@/lib/email/weekly-recap'
import { recordCandidateEmailSent } from '@/lib/email/send-log'
import { neutralizeEmailSubject } from '@/lib/email/neutral-subject'
import MidweekCheckinEmail from '@/emails/midweek-checkin'

const QUIET_THRESHOLD_DAYS = 3

interface Strength {
  title: string
  detail: string
}

export async function sendMidweekCheckin(candidateId: string, introCopy?: string | null) {
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
    const unsubscribeUrl = `${appUrl}/api/unsubscribe/${candidate.id}?type=daily`

    const daysSinceCheckIn = candidate.lastCheckInAt
      ? (Date.now() - candidate.lastCheckInAt.getTime()) / (1000 * 60 * 60 * 24)
      : Infinity
    const isReset = daysSinceCheckIn >= QUIET_THRESHOLD_DAYS

    const primaryAction =
      !isReset && report
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

    const subject = neutralizeEmailSubject(
      insights?.subject ?? (candidate.firstName ? `Midweek check-in, ${candidate.firstName}.` : 'Midweek check-in'),
      candidate.confidentialSearchMode
    )

    const weeklyRecap = !isReset ? await buildWeeklyRecap(candidateId) : null

    const resend = new Resend(process.env.RESEND_API_KEY)
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
        bullets: insights?.bullets ?? null,
        weeklyRecap,
        appUrl,
        unsubscribeUrl,
      }),
    })

    if (error) {
      console.error('Failed to send Midweek Check-in email:', error)
      return { sent: false as const }
    }

    await recordCandidateEmailSent(candidateId, 'MIDWEEK_CHECKIN')
    await prisma.candidateProfile.update({ where: { id: candidateId }, data: { lastDailyEmailSentAt: new Date() } })

    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send Midweek Check-in email:', error)
    return { sent: false as const }
  }
}
