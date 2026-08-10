import 'server-only'
import { Resend } from 'resend'
import type { PrivacyTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { getVictoriaName } from '@/lib/victoria'
import { getCurrentWeekSprint, getCandidateWeekNumber, getMondayOfWeek, type CommittedAction } from '@/lib/weekly/sprint'
import { isProfileChecklistActionType } from '@/lib/weekly/profile-checklist-types'
import { computeWeeklyEngines } from '@/lib/scoring/hireability-grade'
import { recordCandidateEmailSent } from '@/lib/email/send-log'
import FinishLineEmail from '@/emails/finish-line'

// Sunday's email replaces the usual "one thing for today" framing with a
// week-close-out recap, since by Sunday the ask isn't "start something new"
// but "finish out the week strong" — and what that means depends on whether
// they're already past this week's A-grade target or still short of it.
async function buildFinishLineContent(candidateId: string, privacyTier: PrivacyTier, firstName: string | null) {
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

export async function sendFinishLineEmail(candidateId: string, introCopy?: string | null) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping Finish Line email.')
    return { sent: false as const }
  }

  try {
    const candidate = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } })

    const admin = createAdminClient()
    const { data: userData } = await admin.auth.admin.getUserById(candidate.userId)
    const email = userData.user?.email
    if (!email) return { sent: false as const }

    const victoriaName = getVictoriaName('daily-email')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const unsubscribeUrl = `${appUrl}/api/unsubscribe/${candidate.id}?type=daily`

    const { subject, bullets } = await buildFinishLineContent(candidateId, candidate.privacyTier, candidate.firstName)

    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      replyTo: 'support@launchyournextchapter.com',
      to: email,
      subject,
      react: FinishLineEmail({
        firstName: candidate.firstName,
        victoriaName,
        introCopy: introCopy ?? null,
        bullets,
        appUrl,
        unsubscribeUrl,
      }),
    })

    if (error) {
      console.error('Failed to send Finish Line email:', error)
      return { sent: false as const }
    }

    await recordCandidateEmailSent(candidateId, 'FINISH_LINE')
    await prisma.candidateProfile.update({ where: { id: candidateId }, data: { lastDailyEmailSentAt: new Date() } })

    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send Finish Line email:', error)
    return { sent: false as const }
  }
}
