import type { WorkHistoryEntry } from '@prisma/client'

// Ranks by total time spent in each industry, not just recency — a single
// long tenure early in a career is as strong a signal as a short recent
// stint. Recency only breaks ties between industries of similar duration.
// Shared by GoalsForm (onboarding) and SearchStrategyForm (dashboard) so
// both surfaces pre-populate "target industries" the same way.
export function inferIndustriesFromWorkHistory(workHistory: WorkHistoryEntry[]): string[] {
  const durationByIndustry = new Map<string, number>()
  const recencyRankByIndustry = new Map<string, number>()
  workHistory.forEach((entry, index) => {
    if (!entry.companyIndustry) return
    const end = entry.endDate ?? new Date()
    const months = Math.max(0, (end.getTime() - entry.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
    durationByIndustry.set(entry.companyIndustry, (durationByIndustry.get(entry.companyIndustry) ?? 0) + months)
    if (!recencyRankByIndustry.has(entry.companyIndustry)) {
      recencyRankByIndustry.set(entry.companyIndustry, index)
    }
  })
  return [...durationByIndustry.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      return (recencyRankByIndustry.get(a[0]) ?? 0) - (recencyRankByIndustry.get(b[0]) ?? 0)
    })
    .slice(0, 3)
    .map(([industry]) => industry)
}
