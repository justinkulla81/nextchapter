import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { loadReportInput } from './load'
import { buildReport, trendKpis } from './build'
import { monthWindow, previousMonthKey, trailingMonthKeys } from './period'
import type { MonthlyUserReportData, TrendPoint } from './types'

/** How many months the trend strip looks back, this month included. */
const TREND_MONTHS = 6

export interface StoredReport {
  data: MonthlyUserReportData
  trigger: string
  generatedAt: Date
  emailedAt: Date | null
}

function toStored(row: { data: unknown; trigger: string; generatedAt: Date; emailedAt: Date | null }): StoredReport {
  return { data: row.data as MonthlyUserReportData, trigger: row.trigger, generatedAt: row.generatedAt, emailedAt: row.emailedAt }
}

/** Month keys that have a stored report, newest first. Empty if the table isn't there yet. */
export async function listReportMonths(): Promise<string[]> {
  try {
    const rows = await prisma.monthlyUserReport.findMany({ select: { monthKey: true }, orderBy: { monthKey: 'desc' } })
    return rows.map((r) => r.monthKey)
  } catch (e) {
    console.error('monthly-user-report: could not list stored reports', e)
    return []
  }
}

export async function getStoredReport(monthKey: string): Promise<StoredReport | null> {
  try {
    const row = await prisma.monthlyUserReport.findUnique({ where: { monthKey } })
    return row ? toStored(row) : null
  } catch (e) {
    console.error('monthly-user-report: could not read stored report', e)
    return null
  }
}

async function trendFor(monthKey: string, current: TrendPoint): Promise<TrendPoint[]> {
  const keys = trailingMonthKeys(monthKey, TREND_MONTHS).slice(0, -1)
  const rows = await prisma.monthlyUserReport.findMany({ where: { monthKey: { in: keys } }, select: { monthKey: true, data: true } })
  const byKey = new Map(rows.map((r) => [r.monthKey, r.data as unknown as MonthlyUserReportData]))
  const points: TrendPoint[] = []
  for (const key of keys) {
    const d = byKey.get(key)
    if (!d) continue
    points.push({ monthKey: key, label: d.label, kpis: Object.fromEntries(d.headline.map((k) => [k.key, k.value])) })
  }
  return [...points, current]
}

/**
 * Builds the report for one month and stores it, replacing any earlier run
 * for the same month. Safe to run more than once.
 */
export async function generateMonthlyReport(monthKey: string, trigger: 'schedule' | 'manual', now = new Date()): Promise<StoredReport> {
  const current = monthWindow(monthKey)
  const prior = monthWindow(previousMonthKey(monthKey))

  const [input, previous] = await Promise.all([
    loadReportInput(current, prior),
    prisma.monthlyUserReport.findUnique({ where: { monthKey: prior.key }, select: { data: true } }),
  ])
  const storedPriorKpis = Object.fromEntries(
    ((previous?.data as unknown as MonthlyUserReportData | undefined)?.headline ?? []).map((k) => [k.key, k.value]),
  )

  const built = buildReport({ input, current, prior, storedPriorKpis, now })
  const trend = await trendFor(monthKey, {
    monthKey, label: current.label,
    kpis: trendKpis(input.members, current),
  })
  const data: MonthlyUserReportData = { ...built, trend }

  const row = await prisma.monthlyUserReport.upsert({
    where: { monthKey },
    create: { monthKey, data: data as unknown as Prisma.InputJsonValue, memberCount: data.memberCount, trigger, generatedAt: now },
    update: { data: data as unknown as Prisma.InputJsonValue, memberCount: data.memberCount, trigger, generatedAt: now, emailedAt: null },
  })
  return toStored(row)
}

export async function markReportEmailed(monthKey: string, at = new Date()) {
  await prisma.monthlyUserReport.update({ where: { monthKey }, data: { emailedAt: at } }).catch((e) =>
    console.error('monthly-user-report: could not record email time', e),
  )
}
