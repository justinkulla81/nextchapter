import 'server-only'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { getVictoriaName } from '@/lib/victoria'
import { getTodaysPrimaryAction } from '@/lib/daily/primary-action'
import { generateDailyInsights } from '@/lib/emails/generate-insights'
import { getWeek1Artifacts } from '@/lib/sprint/week1'
import DailyActionEmail from '@/emails/daily-action'
import Week1KickoffEmail from '@/emails/week1-kickoff'

const QUIET_THRESHOLD_DAYS = 3

interface Strength {
  title: string
  detail: string
}

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

    const victoriaName = getVictoriaName('daily-email')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const unsubscribeUrl = `${appUrl}/api/unsubscribe/${candidate.id}?type=daily`

    // Victoria's Day 2 kickoff — one-time, replaces the regular daily email
    // for exactly one send, the first full day after registration.
    const daysSinceRegistration = candidate.registrationCompletedAt
      ? (Date.now() - candidate.registrationCompletedAt.getTime()) / (1000 * 60 * 60 * 24)
      : 0
    if (Math.floor(daysSinceRegistration) === 1) {
      const [jobPostings, linkedInActivityLogs, narrative, outreachCount] = await Promise.all([
        prisma.jobPosting.findMany({ where: { candidateId }, select: { coverLetter: true } }),
        prisma.linkedInActivityLog.findMany({ where: { candidateId }, select: { id: true } }),
        prisma.candidateNarrative.findUnique({ where: { candidateId } }),
        prisma.outreachLog.count({ where: { candidateId } }),
      ])
      const artifacts = getWeek1Artifacts({
        linkedInPosted: linkedInActivityLogs.length > 0,
        coverLetterGenerated: jobPostings.some((j) => !!j.coverLetter),
        narrativeGenerated: !!narrative,
        outreachLogged: outreachCount > 0,
      })

      const resend = new Resend(process.env.RESEND_API_KEY)
      const { error } = await resend.emails.send({
        from: 'NextChapter <support@launchyournextchapter.com>',
        replyTo: 'support@launchyournextchapter.com',
        to: email,
        subject: candidate.firstName ? `Your first week, ${candidate.firstName}.` : 'Your first week',
        react: Week1KickoffEmail({
          firstName: candidate.firstName,
          victoriaName,
          artifactLabels: artifacts.map((a) => a.label),
          appUrl,
          unsubscribeUrl,
        }),
      })

      if (error) {
        console.error('Failed to send Week 1 kickoff email:', error)
        return { sent: false as const }
      }

      await prisma.candidateProfile.update({
        where: { id: candidateId },
        data: { lastDailyEmailSentAt: new Date() },
      })
      return { sent: true as const }
    }

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

    const insights =
      !isReset && primaryAction
        ? await generateDailyInsights({
            firstName: candidate.firstName,
            currentStreak: candidate.currentStreak,
            primaryActionText: primaryAction.text,
            strengths: report ? ((report.strengths as unknown as Strength[]) ?? []) : [],
            weaknesses: report ? ((report.weaknesses as unknown as Strength[]) ?? []) : [],
          })
        : null

    const subject =
      insights?.subject ??
      (candidate.firstName && primaryAction
        ? `Your one thing for today, ${candidate.firstName}.`
        : 'Your one thing for today')

    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      replyTo: 'support@launchyournextchapter.com',
      to: email,
      subject,
      react: DailyActionEmail({
        firstName: candidate.firstName,
        victoriaName,
        isReset,
        bullets: insights?.bullets ?? null,
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
