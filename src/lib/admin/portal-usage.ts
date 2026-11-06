import { prisma } from '@/lib/prisma'
import { analyzePortalUsage, etDayKey, type PortalUsage } from '@/lib/admin/portal-usage-analysis'

const DAY_MS = 24 * 60 * 60 * 1000
const EVENT_CAP = 300_000

export interface PortalUsageResult {
  usage: PortalUsage
  windowDays: number
  /** True when the event cap cut off the oldest views, so the window is shorter than asked. */
  truncated: boolean
}

// Real members' logged-in page views for the last `windowDays` days (seeded sample and system accounts left out).
export async function loadPortalUsage(windowDays: number): Promise<PortalUsageResult> {
  const nowMs = Date.now()
  const rows = await prisma.candidatePageActivityEvent.findMany({
    where: {
      eventType: 'PAGE_VIEW',
      createdAt: { gte: new Date(nowMs - windowDays * DAY_MS) },
      candidate: { isSampleData: false, isSystemAccount: false },
    },
    select: { candidateId: true, path: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: EVENT_CAP,
  })
  const keys = Array.from({ length: windowDays }, (_, i) => etDayKey(new Date(nowMs - (windowDays - 1 - i) * DAY_MS)))
  return { usage: analyzePortalUsage(rows, keys), windowDays, truncated: rows.length >= EVENT_CAP }
}
