import 'server-only'
import { prisma } from '@/lib/prisma'
import { pointsNeededForA } from '@/lib/weekly/action-effort'
import { sendSprintGoalReminderEmail } from '@/lib/email/send-sprint-goal-reminder'
import type { SprintGoalReminderVariant } from '@/emails/sprint-goal-reminder'

// Shared by all three goal-setting cron routes (open/reminder/final) — same
// eligibility check and send call, only the variant (and therefore the
// email copy) differs. Skips anyone who has already locked in goals for the
// upcoming week, so these only ever reach candidates who still need to act.
export async function sendGoalReminders(targetMonday: Date, variant: SprintGoalReminderVariant) {
  const eligible = await prisma.candidateProfile.findMany({
    where: { registrationCompletedAt: { not: null }, sprintGoalEmailsOptedOut: false },
    select: { id: true, userId: true, firstName: true, _count: { select: { weeklySprints: true } } },
  })

  let sentCount = 0
  for (const candidate of eligible) {
    try {
      const existing = await prisma.weeklySprint.findUnique({
        where: { candidateId_weekStartDate: { candidateId: candidate.id, weekStartDate: targetMonday } },
      })
      if (existing) continue

      const weekNumber = candidate._count.weeklySprints + 1
      const result = await sendSprintGoalReminderEmail(candidate, variant, pointsNeededForA(weekNumber))
      if (result.sent) sentCount += 1
    } catch (error) {
      console.error(`Sprint goal ${variant} reminder failed for candidate`, candidate.id, error)
    }
  }

  return { checked: eligible.length, sent: sentCount }
}
