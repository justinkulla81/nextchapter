import 'server-only'
import { prisma } from '@/lib/prisma'
import { getMondayOfWeek, type CommittedAction } from '@/lib/weekly/sprint'

export interface LastWeekActions {
  weekStartDate: Date
  committed: CommittedAction[] // the locked commitment, one-time and recurring mixed
  fromCatalog: CommittedAction[] // logged mid-week from "More Actions Available"
}

// "Last week's actions," grouped Committed vs. catalog (Prompt 52) — reuses
// the same addedFromCatalog split already tracked on CommittedAction for
// the dashboard's two-tier list (Prompt 45), just for the prior week.
export async function getLastWeekActions(candidateId: string): Promise<LastWeekActions | null> {
  const thisWeekStart = getMondayOfWeek(new Date())
  const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 86400000)

  const sprint = await prisma.weeklySprint.findUnique({
    where: { candidateId_weekStartDate: { candidateId, weekStartDate: lastWeekStart } },
  })
  if (!sprint) return null

  const actions = sprint.committedActions as unknown as CommittedAction[]
  return {
    weekStartDate: lastWeekStart,
    committed: actions.filter((a) => !a.addedFromCatalog),
    fromCatalog: actions.filter((a) => a.addedFromCatalog),
  }
}
