import 'server-only'
import type { PlanBillingPeriod, PlanCatalogCategory, PlanCatalogEntry } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export { PLAN_KEYS, PLAN_LABELS, PLAN_CATEGORY_LABELS, BILLING_PERIOD_LABELS, type PlanKey } from '@/lib/constants/plan-catalog'

export interface PlanCatalogHistoryEntry extends PlanCatalogEntry {
  isCurrent: boolean
}

// Full history (current + past) grouped by planKey — "current" for new
// signups is each key's latest active row with effectiveDate already
// arrived, computed independently per key exactly like the rate card's
// per-(sessionType, coachId) grouping.
export async function getPlanCatalogHistory(): Promise<Record<string, PlanCatalogHistoryEntry[]>> {
  const rows = await prisma.planCatalogEntry.findMany({
    orderBy: [{ planKey: 'asc' }, { effectiveDate: 'desc' }],
  })

  const now = new Date()
  const seenCurrent = new Set<string>()
  const result: Record<string, PlanCatalogHistoryEntry[]> = {}

  for (const row of rows) {
    const alreadyEffective = row.active && row.effectiveDate <= now
    const isCurrent = alreadyEffective && !seenCurrent.has(row.planKey)
    if (isCurrent) seenCurrent.add(row.planKey)
    result[row.planKey] = result[row.planKey] ?? []
    result[row.planKey].push({ ...row, isCurrent })
  }

  return result
}

// What a new signup/enrollment on this plan pays today. Not used by any
// checkout flow yet (no live Stripe integration this phase — see this
// phase's report) but is the function later phases (marketing pricing page,
// Phase 10) should call instead of hardcoding a price in JSX.
export async function getCurrentPlan(planKey: string): Promise<PlanCatalogEntry | null> {
  return prisma.planCatalogEntry.findFirst({
    where: { planKey, active: true, effectiveDate: { lte: new Date() } },
    orderBy: { effectiveDate: 'desc' },
  })
}

export async function createPlanCatalogEntry(input: {
  planKey: string
  name: string
  category: PlanCatalogCategory
  priceCents: number
  billingPeriod: PlanBillingPeriod
  termMonths: number | null
  features: string[]
  effectiveDate: Date
  active: boolean
  createdBy: string
}): Promise<PlanCatalogEntry> {
  return prisma.planCatalogEntry.create({ data: input })
}
