import 'server-only'
import { prisma } from '@/lib/prisma'
import type { CommittedAction } from '@/lib/weekly/sprint'

export interface DailyActivity {
  date: string // YYYY-MM-DD, UTC
  points: number
}

// GitHub-contribution-style heatmap data (Prompt 52) — "points earned per
// day," reconstructed from WeeklySprint.committedActions' own completedAt
// timestamps rather than a dedicated daily table (none exists). Looks back
// `weeks` weeks of WeeklySprint rows.
export async function getDailyActivity(candidateId: string, weeks = 26): Promise<DailyActivity[]> {
  const cutoff = new Date(Date.now() - weeks * 7 * 86400000)
  const sprints = await prisma.weeklySprint.findMany({
    where: { candidateId, weekStartDate: { gte: cutoff } },
    select: { committedActions: true },
  })

  const pointsByDay = new Map<string, number>()
  for (const sprint of sprints) {
    const actions = sprint.committedActions as unknown as CommittedAction[]
    for (const action of actions) {
      if (!action.completed || !action.completedAt) continue
      const day = action.completedAt.slice(0, 10) // YYYY-MM-DD
      pointsByDay.set(day, (pointsByDay.get(day) ?? 0) + action.points)
    }
  }

  return Array.from(pointsByDay.entries())
    .map(([date, points]) => ({ date, points }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
