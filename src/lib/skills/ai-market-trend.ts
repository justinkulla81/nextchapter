// The AI-skill share over time, from the stored AI market snapshots (one per nightly run, newest 60
// kept). Pure: one point per week (the last snapshot of that week), shown only once there are
// MIN_TREND_WEEKS of them. Tested in src/test/ai-skills-public.test.ts.

import type { AiMarketData } from '@/lib/skills/ai-market'

export const MIN_TREND_WEEKS = 4

export interface TrendPoint {
  weekOf: string
  sharePct: number
}

const mondayKey = (d: Date) => {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7))
  return x.toISOString().slice(0, 10)
}

/** Share of full-text postings that ask for a specific AI skill, one point per week, oldest first. */
export function weeklyShareTrend(snapshots: { computedAt: Date; data: Pick<AiMarketData, 'counts'> }[]): TrendPoint[] | null {
  const byWeek = new Map<string, TrendPoint>()
  for (const s of [...snapshots].sort((a, b) => a.computedAt.getTime() - b.computedAt.getTime())) {
    const { aiSkillFullText, fullText } = s.data.counts
    if (!fullText) continue
    byWeek.set(mondayKey(s.computedAt), { weekOf: mondayKey(s.computedAt), sharePct: Math.round((1000 * aiSkillFullText) / fullText) / 10 })
  }
  const points = [...byWeek.values()]
  return points.length >= MIN_TREND_WEEKS ? points : null
}
