import 'server-only'
import { prisma } from '@/lib/prisma'
import { loadCountyContext } from '@/lib/workforce/county-context-data'
import { areaContext, type AreaContext } from '@/lib/workforce/county-context'
import { boardLabor } from '@/lib/workforce/labor'
import { placeOutlook, type PlaceOutlook } from '@/lib/places/outlook'

// What a place page adds beyond its own counts: an outlook from bundled public data (county jobs and population) and
// the stored unemployment rows, and the latest news in the area of the workforce boards that serve it.

export interface PlaceSignals { outlook: PlaceOutlook; context: AreaContext | null }

export async function getPlaceSignals(fips: string[]): Promise<PlaceSignals> {
  if (!fips.length) return { outlook: placeOutlook({ jobsChangePct: null, populationChangePct: null, unemployment: null }), context: null }
  const [{ context }, labor] = await Promise.all([
    loadCountyContext(),
    prisma.countyLabor.findMany({ where: { fips: { in: fips } }, select: { laborForce: true, unemployed: true, rateYearAgo: true, period: true } }).catch(() => []),
  ])
  const rows = fips.map((f) => context.counties[f]).filter(Boolean)
  // Jobs change only over counties that report both years: a county new since 2022 has no base.
  const both = rows.filter((r) => r.t && r.t[0] >= 0 && r.t[1] >= 0)
  const then = both.reduce((s, r) => s + r.t![0], 0)
  const now = both.reduce((s, r) => s + r.t![1], 0)
  const ctx = areaContext(context, fips)
  const l = boardLabor(labor)
  return {
    context: ctx,
    outlook: placeOutlook({
      jobsChangePct: then > 0 ? ((now - then) / then) * 100 : null,
      populationChangePct: ctx.population?.changePct ?? null,
      unemployment: l && l.rateYearAgo != null ? { rate: l.rate, yearAgo: l.rateYearAgo } : null,
    }),
  }
}

export interface PlaceNewsItem { title: string; url: string; publisher: string | null; publishedAt: Date | null }

/** The latest news (layoffs, AI and jobs) in the areas of these workforce boards: headline, publisher, date and link. */
export async function getPlaceNews(boardIds: string[], limit = 8): Promise<PlaceNewsItem[]> {
  if (!boardIds.length) return []
  const rows = await prisma.workforceBoardNews.findMany({
    where: { boardId: { in: boardIds }, publishedAt: { gte: new Date(Date.now() - 90 * 86_400_000) } },
    orderBy: { publishedAt: 'desc' },
    take: limit * 3,
    select: { title: true, url: true, publisher: true, publishedAt: true },
  }).catch(() => [])
  const seen = new Set<string>()
  const out: PlaceNewsItem[] = []
  for (const r of rows) {
    const k = r.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 60)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(r)
    if (out.length >= limit) break
  }
  return out
}
