import 'server-only'
import { Resend } from 'resend'
import type { PrivacyTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { getVictoriaName } from '@/lib/victoria'
import { getTodaysPrimaryAction, type ActionDay } from '@/lib/daily/primary-action'
import { generateDailyInsights } from '@/lib/emails/generate-insights'
import { getWeek1Artifacts } from '@/lib/sprint/week1'
import { shouldSendDailyEmailForTier } from '@/lib/email/notification-tier'
import { getCurrentWeekSprint, getCandidateWeekNumber, getMondayOfWeek, type CommittedAction } from '@/lib/weekly/sprint'
import { pointsNeededForA } from '@/lib/weekly/action-effort'
import { isProfileChecklistActionType } from '@/lib/weekly/profile-checklist-types'
import { computeWeeklyEngines } from '@/lib/scoring/hireability-grade'
import DailyActionEmail from '@/emails/daily-action'
import Week1KickoffEmail from '@/emails/week1-kickoff'

const QUIET_THRESHOLD_DAYS = 3

interface Strength {
  title: string
  detail: string
}

// A running "here's what you've gotten done this week" recap folded into
// the daily nudge — reinforces progress already made instead of only ever
// asking for the next thing. Returns null before anything's been completed
// yet this week (a 0-of-N recap reads as a nag, not encouragement).
async function buildWeeklyRecap(candidateId: string) {
  const weekNumber = await getCandidateWeekNumber(candidateId, getMondayOfWeek(new Date()))
  const sprint = await getCurrentWeekSprint(candidateId)
  if (!sprint) return null

  const actions = (sprint.committedActions as unknown as CommittedAction[]) ?? []
  const completed = actions.filter(
    (a) => a.completed && !a.isGoalBonus && !isProfileChecklistActionType(a.actionType)
  )
  if (completed.length === 0) return null

  const pointsEarned = completed.reduce((sum, a) => sum + a.points, 0)
  const completedTexts = [...new Set(completed.map((a) => a.text))].slice(0, 5)

  return {
    pointsEarned,
    pointsTarget: pointsNeededForA(weekNumber),
    completedTexts,
  }
}

// Sunday's daily nudge replaces the usual "one thing for today" framing with
// a week-close-out recap, since by Sunday the ask isn't "start something new"
// but "finish out the week strong" — and what that means depends on whether
// they're already past this week's A-grade target or still short of it.
async function buildSundayFinishStrong(candidateId: string, privacyTier: PrivacyTier, firstName: string | null) {
  const weekNumber = await getCandidateWeekNumber(candidateId, getMondayOfWeek(new Date()))
  const { engines, weeklyPoints, weeklyPointsTarget } = await computeWeeklyEngines(candidateId, weekNumber, privacyTier)

  const sprint = await getCurrentWeekSprint(candidateId)
  const actions = sprint ? ((sprint.committedActions as unknown as CommittedAction[]) ?? []) : []
  const outstanding = actions
    .filter((a) => !a.completed && !a.isGoalBonus && !isProfileChecklistActionType(a.actionType))
    .sort((a, b) => b.points - a.points)

  const namePart = firstName ? `, ${firstName}` : ''

  if (weeklyPoints >= weeklyPointsTarget) {
    const overperformedLabels = engines.filter((e) => e.grade === 'A').map((e) => e.label)
    const bullets: string[] = [
      `You're at ${weeklyPoints} of ${weeklyPointsTarget} points — you've already locked in this week's A.`,
    ]
    if (overperformedLabels.length > 0) {
      bullets.push(`You overperformed on: ${overperformedLabels.join(', ')}.`)
    }
    const stillOpen = outstanding.slice(0, 2).map((a) => a.text)
    if (stillOpen.length > 0) {
      bullets.push(`Still open if you want to keep the streak going: ${stillOpen.join('; ')}.`)
    }
    return { subject: `Finish the week strong${namePart} — you're already on pace.`, bullets }
  }

  const pointsToGo = weeklyPointsTarget - weeklyPoints
  const laggingLabels = engines
    .filter((e) => e.grade !== 'A')
    .sort((a, b) => a.score - b.score)
    .map((e) => e.label)

  const bullets: string[] = [
    `You're at ${weeklyPoints} of ${weeklyPointsTarget} points. You need ${pointsToGo} more by midnight to lock in an A this week.`,
  ]
  if (laggingLabels.length > 0) {
    bullets.push(`Focus your remaining hours on: ${laggingLabels.join(', ')}.`)
  }
  const fastestActions = outstanding.slice(0, 3).map((a) => `${a.text} (+${a.points})`)
  if (fastestActions.length > 0) {
    bullets.push(`Fastest way there: ${fastestActions.join('; ')}.`)
  }

  return { subject: `Finish the week strong${namePart} — here's what gets you an A.`, bullets }
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
        prisma.candidateNarrative.findFirst({ where: { candidateId } }),
        prisma.outreachLog.count({ where: { candidateId } }),
      ])
      const artifacts = getWeek1Artifacts({
        linkedInPosted: linkedInActivityLogs.length > 0,
        coverLetterGenerated: jobPostings.some((j) => !!j.coverLetter),
        narrativeGenerated: !!narrative,
        outreachLogged: outreachCount > 0,
      })

      const firstDay = report ? (report.actionPlan as unknown as ActionDay[])[0] : undefined
      const topActions = (firstDay?.items ?? [])
        .slice(0, 3)
        .map((item) => (typeof item === 'string' ? item : item.text))

      const resend = new Resend(process.env.RESEND_API_KEY)
      const { error } = await resend.emails.send({
        from: 'NextChapter <support@launchyournextchapter.com>',
        replyTo: 'support@launchyournextchapter.com',
        to: email,
        subject: candidate.firstName
          ? `Your Day 2 action plan is ready, ${candidate.firstName}`
          : 'Your Day 2 action plan is ready',
        react: Week1KickoffEmail({
          firstName: candidate.firstName,
          victoriaName: getVictoriaName('introduction'),
          artifactLabels: artifacts.map((a) => a.label),
          topActions,
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

    // The Week 1 kickoff above is a one-time onboarding email and always
    // sends; only the recurring nudge below is gated by notification tier.
    if (!shouldSendDailyEmailForTier(candidate.notificationTier, new Date())) {
      return { sent: false as const }
    }

    const daysSinceCheckIn = candidate.lastCheckInAt
      ? (Date.now() - candidate.lastCheckInAt.getTime()) / (1000 * 60 * 60 * 24)
      : Infinity
    const isReset = daysSinceCheckIn >= QUIET_THRESHOLD_DAYS
    const isSunday = new Date().getUTCDay() === 0

    const sundayRecap =
      !isReset && isSunday ? await buildSundayFinishStrong(candidateId, candidate.privacyTier, candidate.firstName) : null

    const primaryAction =
      !isReset && !sundayRecap && report
        ? getTodaysPrimaryAction(
            report.actionPlan as unknown as Parameters<typeof getTodaysPrimaryAction>[0],
            report.generatedAt
          )
        : null

    // Runs even with no primaryAction (e.g. before the week's actions are
    // assigned) — the prompt falls back to reminding them what they're
    // working toward instead of restating a task that doesn't exist yet.
    const insights =
      !isReset && !sundayRecap
        ? await generateDailyInsights({
            firstName: candidate.firstName,
            currentStreak: candidate.currentStreak,
            primaryActionText: primaryAction?.text ?? null,
            targetFunction: candidate.targetFunction ?? candidate.targetRoleType ?? null,
            opportunity: report ? ((report.weaknesses as unknown as Strength[])[0] ?? null) : null,
          })
        : null

    const subject =
      sundayRecap?.subject ??
      insights?.subject ??
      (candidate.firstName && primaryAction
        ? `Your one thing for today, ${candidate.firstName}.`
        : 'Your one thing for today')

    // Sunday's bullets already are the weekly recap — the separate recap box
    // would just repeat the same points/completed-actions a second time.
    const weeklyRecap = !isReset && !sundayRecap ? await buildWeeklyRecap(candidateId) : null

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
        bullets: sundayRecap?.bullets ?? insights?.bullets ?? null,
        weeklyRecap,
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
