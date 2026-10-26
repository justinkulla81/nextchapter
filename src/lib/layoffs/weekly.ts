import 'server-only'
import { getPublicNotices, type PublicNotice } from '@/lib/warn/layoff-pages'
import { nextWeek, parseWeekId, weekEnd, weekId, weekStart } from '@/lib/layoffs/weeks'

export interface WeekSummary { id: string; monday: Date; count: number; workers: number }

/** Notices needed before a week's page is offered to search engines. */
export const WEEK_MIN_NOTICES = 3
/** How far back weekly pages go (the notice record keeps 24 months). */
export const WEEKS_BACK = 104

export const currentWeekStart = () => weekStart(new Date())

/** Every complete week with at least one notice, newest first. The current week lives on /layoffs/this-week. */
export async function getWeeks(): Promise<WeekSummary[]> {
  const notices = await getPublicNotices().catch(() => [] as PublicNotice[])
  const current = currentWeekStart().getTime()
  const floor = current - WEEKS_BACK * 7 * 86_400_000
  const by = new Map<string, WeekSummary>()
  for (const n of notices) {
    const monday = weekStart(n.noticeDate)
    if (monday.getTime() >= current || monday.getTime() < floor) continue
    const id = weekId(monday)
    const e = by.get(id) ?? { id, monday, count: 0, workers: 0 }
    e.count++
    e.workers += n.workers ?? 0
    by.set(id, e)
  }
  return [...by.values()].sort((a, b) => b.monday.getTime() - a.monday.getTime())
}

export async function getWeekNotices(id: string): Promise<{ monday: Date; notices: PublicNotice[] } | null> {
  const monday = parseWeekId(id)
  if (!monday) return null
  const start = monday.getTime()
  const end = weekEnd(monday).getTime()
  const notices = (await getPublicNotices().catch(() => [] as PublicNotice[])).filter((n) => n.noticeDate.getTime() >= start && n.noticeDate.getTime() <= end)
  return { monday, notices }
}

export { nextWeek }
