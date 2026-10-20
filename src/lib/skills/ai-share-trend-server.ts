import 'server-only'
import { prisma } from '@/lib/prisma'
import { sharePct } from '@/lib/skills/ai-share-snapshot'

export const MIN_TREND_WEEKS = 4

/** The whole-board AI share by week, oldest first; null until MIN_TREND_WEEKS weeks exist or if the table is missing. */
export async function loadAiShareTrend(): Promise<{ weekOf: string; sharePct: number }[] | null> {
  try {
    const rows = await prisma.aiShareSnapshot.findMany({ where: { fn: 'all' }, orderBy: { weekOf: 'asc' }, take: 104 })
    if (rows.length < MIN_TREND_WEEKS) return null
    return rows.map((r) => ({ weekOf: r.weekOf.toISOString().slice(0, 10), sharePct: sharePct(r) }))
  } catch {
    return null
  }
}
