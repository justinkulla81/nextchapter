import 'server-only'
import { prisma } from '@/lib/prisma'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { sumEffortMinutes } from '@/lib/scoring/effort-minutes'

// What a supporter is allowed to know: effort, in numbers. Never names of
// people, companies, jobs or message content.
export interface SupporterSummary {
  firstName: string
  minutesThisWeek: number
  daysActive: number
  actionsDone: number
  messagesSent: number
  applications: number
}

export async function buildSupporterSummary(candidateId: string, now = new Date()): Promise<SupporterSummary | null> {
  const weekStart = getMondayOfWeek(now)
  const [profile, sprint, outreach, applications] = await Promise.all([
    prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { firstName: true, confidentialSearchMode: true } }),
    prisma.weeklySprint.findUnique({ where: { candidateId_weekStartDate: { candidateId, weekStartDate: weekStart } }, select: { committedActions: true } }),
    prisma.outreachLog.findMany({ where: { candidateId, loggedAt: { gte: weekStart } }, select: { loggedAt: true } }),
    prisma.jobPosting.findMany({ where: { candidateId, appliedAt: { gte: weekStart } }, select: { appliedAt: true } }),
  ])
  // Confidential search is a hard rule: no one outside NextChapter hears anything.
  if (!profile || profile.confidentialSearchMode) return null

  const actions = Array.isArray(sprint?.committedActions) ? (sprint!.committedActions as Array<{ completed?: boolean; completedAt?: string }>) : []
  const days = new Set<string>()
  for (const a of actions) if (a.completed && a.completedAt) days.add(a.completedAt.slice(0, 10))
  for (const o of outreach) days.add(o.loggedAt.toISOString().slice(0, 10))
  for (const j of applications) if (j.appliedAt) days.add(j.appliedAt.toISOString().slice(0, 10))

  return {
    firstName: profile.firstName ?? 'Your friend',
    minutesThisWeek: sumEffortMinutes(sprint ? [sprint] : []),
    daysActive: days.size,
    actionsDone: actions.filter((a) => a.completed).length,
    messagesSent: outreach.length,
    applications: applications.length,
  }
}

// One warm, plain sentence. Always optimistic; a quiet week gets an
// encouraging line that points the supporter at what helps (a cheer).
export function supporterHeadline(s: SupporterSummary): string {
  if (s.minutesThisWeek >= 120) return `${s.firstName} is putting in real work this week: ${s.minutesThisWeek} minutes so far.`
  if (s.minutesThisWeek > 0) return `${s.firstName} is moving: ${s.minutesThisWeek} minutes so far this week. A cheer now keeps it going.`
  return `${s.firstName} is just getting going this week. A short note from you can make today's first step easier.`
}
