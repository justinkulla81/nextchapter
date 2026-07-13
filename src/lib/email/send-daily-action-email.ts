import 'server-only'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { getVictoriaName } from '@/lib/victoria'
import { getTodaysPrimaryAction } from '@/lib/daily/primary-action'
import DailyActionEmail from '@/emails/daily-action'

const QUIET_THRESHOLD_DAYS = 3

export async function sendDailyActionEmail(candidateId: string) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping daily action email.')
    return { sent: false as const }
  }

  try {
    const [candidate, report] = await Promise.all([
      prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } }),
      prisma.hireabilityReport.findFirst({
        where: { candidateId },
        orderBy: { generatedAt: 'desc' },
      }),
    ])

    const admin = createAdminClient()
    const { data: userData } = await admin.auth.admin.getUserById(candidate.userId)
    const email = userData.user?.email
    if (!email) return { sent: false as const }

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

    const victoriaName = getVictoriaName('daily-email')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const unsubscribeUrl = `${appUrl}/api/unsubscribe/${candidate.id}?type=daily`

    const subject =
      candidate.firstName && primaryAction
        ? `Your one thing for today, ${candidate.firstName}.`
        : 'Your one thing for today'

    const greetingLine =
      candidate.currentStreak > 1
        ? `you're on a ${candidate.currentStreak}-day streak — let's keep it going.`
        : "here's today's plan."

    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <hello@launchyournextchapter.com>',
      replyTo: 'justin.kulla@gmail.com',
      to: email,
      subject,
      react: DailyActionEmail({
        firstName: candidate.firstName,
        victoriaName,
        greetingLine,
        primaryActionText: primaryAction?.text ?? null,
        whyItMatters: primaryAction ? 'This is the highest-leverage move on your plan right now.' : null,
        engineHint: primaryAction?.engineHint ?? null,
        isReset,
        appUrl,
        unsubscribeUrl,
      }),
    })

    if (error) {
      console.error('Failed to send daily action email:', error)
      return { sent: false as const }
    }

    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: { lastDailyEmailSentAt: new Date() },
    })

    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send daily action email:', error)
    return { sent: false as const }
  }
}
