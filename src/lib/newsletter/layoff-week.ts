import { topEmployers } from '@/lib/layoffs/monthly'
import { stateName } from '@/lib/seo/states'
import type { PublicNotice } from '@/lib/warn/layoff-pages'

// The "Layoffs this week" block of the weekly newsletter: the last seven days of public WARN notices, facts only. Pure, so the email and its test
// read the same numbers the /layoffs/this-week page shows.

const WEEK = 7 * 86_400_000
/** Under this many notices the week is too quiet to be worth a block (the same bar as the /layoffs/this-week page). */
export const LAYOFF_WEEK_MIN_NOTICES = 3
const TOP = 5

export interface LayoffWeekBrief {
  notices: number
  workers: number
  states: number
  top: { name: string; workers: number; state: string | null }[]
}

export function buildLayoffWeekBrief(all: PublicNotice[], now = Date.now()): LayoffWeekBrief | null {
  const week = all.filter((n) => n.noticeDateKnown && now - n.noticeDate.getTime() >= 0 && now - n.noticeDate.getTime() < WEEK)
  if (week.length < LAYOFF_WEEK_MIN_NOTICES) return null
  const stateOf = new Map<string, string>()
  for (const n of week) if (!stateOf.has(n.slug)) stateOf.set(n.slug, stateName(n.state))
  return {
    notices: week.length,
    workers: week.reduce((s, n) => s + (n.workers ?? 0), 0),
    states: new Set(week.map((n) => n.state)).size,
    top: topEmployers(week, TOP).map((e) => ({ name: e.name, workers: e.workers, state: stateOf.get(e.slug) ?? null })),
  }
}
