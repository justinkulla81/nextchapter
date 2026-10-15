import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { getVictoriaName } from '@/lib/victoria'
import { getTodaysPrimaryAction } from '@/lib/daily/primary-action'
import { generateDailyInsights } from '@/lib/emails/generate-insights'
import { buildWeeklyRecap } from '@/lib/email/weekly-recap'
import { isQuietCandidate } from '@/lib/email/is-quiet-candidate'
import { recordCandidateEmailSent } from '@/lib/email/send-log'
import { neutralizeEmailSubject } from '@/lib/email/neutral-subject'
import DailyActionEmail from '@/emails/daily-action'
import { candidateUnsubscribeUrl } from '@/lib/email/signed-links'

interface Strength {
  title: string
  detail: string
}

// Wednesday's "Daily Nudge" — the generic one-thing-today email. Sunday
// (Finish Line) and Thursday (Midweek Check-in) have their own senders now;
// Week 1's onboarding kickoff is its own daily cron entirely. Day-of-week
// and notification-tier eligibility are the caller's responsibility (the
// candidate-email-dispatch cron's eligibility query + hasAlreadySentToday).
export async function sendDailyActionEmail(candidateId: string, introCopy?: string | null) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping daily action email.')
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

    // Runs even with no primaryAction (e.g. before the week's actions are
    // assigned) — the prompt falls back to reminding them what they're
    // working toward instead of restating a task that doesn't exist yet.
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
      insights?.subject ??
        (isReset && primaryAction
          ? `${candidate.firstName ? `${candidate.firstName}, let's` : "Let's"} get started — one 5-minute step`
          : null) ??
        (candidate.firstName && primaryAction
          ? `Your one thing for today, ${candidate.firstName}.`
          : 'Your one thing for today'),
      candidate.confidentialSearchMode
    )

    const weeklyRecap = !isReset ? await buildWeeklyRecap(candidateId) : null

    const resend = createResend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      replyTo: 'support@launchyournextchapter.com',
      to: email,
      subject,
      react: DailyActionEmail({
        firstName: candidate.firstName,
        victoriaName,
        introCopy: introCopy ?? null,
        isReset,
        resetTask: isReset ? (primaryAction?.text ?? null) : null,
        bullets: insights?.bullets ?? null,
        weeklyRecap,
        appUrl,
        unsubscribeUrl,
      }),
    })

    if (error) {
      console.error('Failed to send daily action email:', error)
      return { sent: false as const }
    }

    await recordCandidateEmailSent(candidateId, 'DAILY_NUDGE')
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
