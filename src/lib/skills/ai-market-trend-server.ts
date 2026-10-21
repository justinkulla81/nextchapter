import 'server-only'
import { prisma } from '@/lib/prisma'
import type { AiMarketData } from '@/lib/skills/ai-market'
import { weeklyShareTrend, type TrendPoint } from '@/lib/skills/ai-market-trend'

/** The weekly AI-skill share from stored snapshots; null until 4 weeks exist or if they can't be read. */
export async function loadAiShareTrend(): Promise<TrendPoint[] | null> {
  try {
    const rows = await prisma.aiMarketSnapshot.findMany({ orderBy: { computedAt: 'asc' }, select: { computedAt: true, data: true }, take: 120 })
    return weeklyShareTrend(rows.map((r) => ({ computedAt: r.computedAt, data: r.data as unknown as AiMarketData })))
  } catch {
    return null
  }
}
