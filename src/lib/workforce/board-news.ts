import 'server-only'
import { prisma } from '@/lib/prisma'
import { searchTopic, type DiscoveredArticle } from '@/lib/news/discover'
import { STATE_NAMES, areaPlaces } from './places'

/**
 * The news in each board's area: layoffs there, and AI and jobs there. One
 * news search per topic per board, keeping only articles that name a place
 * the board serves — a search for "Dallas layoffs" also returns national
 * stories, and those are not the board's.
 */
export const BOARD_NEWS_TOPICS = {
  layoffs: { query: 'layoffs', must: /\b(layoffs?|laid off|lay off|job cuts?|cutting jobs|closing|closure|plant closing|WARN notice|furlough)/i },
  ai: { query: 'AI jobs workers', must: /\b(AI|A\.I\.|artificial intelligence|automation|automated)\b[\s\S]*\b(jobs?|workers?|workforce|employ|hiring|layoffs?)|\b(jobs?|workers?|workforce|employ|hiring|layoffs?)\b[\s\S]*\b(AI|A\.I\.|artificial intelligence|automation)\b/i },
} as const
export type BoardNewsTopic = keyof typeof BOARD_NEWS_TOPICS

type NewsBoard = { id: string; state: string; address: string | null; counties: string[]; serviceArea: string | null; placeCounties: string[]; statewide: boolean }

/** The city a board's office is in — the name its area's news uses. */
export function boardCity(address: string | null): string | null {
  const last = address?.split(',').map((s) => s.trim())
  if (!last?.length) return null
  // "…, Arlington, TX 76011" → "Arlington"
  const i = last.findIndex((p) => /^[A-Z]{2}\s+\d{5}/.test(p))
  return i > 0 ? last[i - 1].replace(/^(po box|suite|ste)\b.*$/i, '').trim() || null : null
}

const title = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase())

/** Place names an article must mention to count as this board's news. */
export function boardPlaceNames(b: NewsBoard): string[] {
  const names = new Set<string>()
  // A board for a whole state: the state's news is its news.
  if (b.statewide && STATE_NAMES[b.state]) return [STATE_NAMES[b.state]]
  const city = boardCity(b.address)
  if (city) names.add(city)
  for (const c of [...b.counties, ...b.placeCounties]) if (c.length >= 4) names.add(`${title(c)} County`)
  for (const p of areaPlaces(b.serviceArea)) if (p.length >= 4) names.add(title(p))
  return [...names]
}

export function articleIsLocal(a: Pick<DiscoveredArticle, 'title' | 'description'>, places: string[], topic: BoardNewsTopic): boolean {
  const text = `${a.title} ${a.description ?? ''}`
  if (!BOARD_NEWS_TOPICS[topic].must.test(text)) return false
  // "Cleveland-Cliffs" is a company, not Cleveland.
  return places.some((p) => new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b(?!-)`, 'i').test(text))
}

/**
 * Searches news for boards checked longest ago, boards with recent layoffs
 * first, until the budget is spent. The search returns the past week, so a
 * board checked every few days misses nothing.
 */
export async function refreshBoardNews(budgetMs = 120_000, perTopic = 5): Promise<{ boards: number; added: number; stopped?: string }> {
  const started = Date.now()
  const active = await prisma.warnNotice.groupBy({
    by: ['workforceBoardId'],
    where: { workforceBoardId: { not: null }, dismissedAt: null, noticeDate: { gte: new Date(Date.now() - 365 * 86_400_000) } },
  })
  const activeIds = new Set(active.map((a) => a.workforceBoardId!))
  const boards = (await prisma.workforceBoard.findMany({
    select: { id: true, state: true, address: true, counties: true, serviceArea: true, placeCounties: true, statewide: true, newsCheckedAt: true },
  }))
    .filter((b) => activeIds.has(b.id))
    .sort((a, b) => (a.newsCheckedAt?.getTime() ?? 0) - (b.newsCheckedAt?.getTime() ?? 0))
  let done = 0
  let added = 0
  for (const b of boards) {
    if (Date.now() - started > budgetMs) break
    const places = boardPlaceNames(b)
    const anchor = b.statewide ? places[0] : boardCity(b.address) ?? places[0]
    if (!anchor) {
      await prisma.workforceBoard.update({ where: { id: b.id }, data: { newsCheckedAt: new Date() } })
      continue
    }
    for (const topic of Object.keys(BOARD_NEWS_TOPICS) as BoardNewsTopic[]) {
      let found: DiscoveredArticle[]
      try {
        const where = b.statewide ? `"${anchor}"` : `"${anchor}" ${STATE_NAMES[b.state] ?? b.state}`
        found = await searchTopic(`${where} ${BOARD_NEWS_TOPICS[topic].query}`)
      } catch (e) {
        return { boards: done, added, stopped: e instanceof Error ? e.message : String(e) }
      }
      const local = found.filter((a) => articleIsLocal(a, places, topic)).slice(0, perTopic)
      if (local.length) {
        const res = await prisma.workforceBoardNews.createMany({
          // A layoff story about AI is filed under AI: that is the story.
          data: local.map((a) => ({
            boardId: b.id,
            topic: BOARD_NEWS_TOPICS.ai.must.test(`${a.title} ${a.description ?? ''}`) ? 'ai' : topic,
            title: a.title, url: a.url, publisher: a.source, publishedAt: a.publishedAt,
          })),
          skipDuplicates: true,
        })
        added += res.count
      }
    }
    await prisma.workforceBoard.update({ where: { id: b.id }, data: { newsCheckedAt: new Date() } })
    done++
  }
  return { boards: done, added }
}
