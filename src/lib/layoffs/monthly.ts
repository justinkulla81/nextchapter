import 'server-only'
import { getPublicNotices, type PublicNotice } from '@/lib/warn/layoff-pages'

/** The year the /layoffs/2026 pages cover. A new year gets its own folder, so last year's addresses never change. */
export const LAYOFF_YEAR = 2026
/** Notices needed before a month's page is offered to search engines. */
export const MONTH_MIN_NOTICES = 10

export const MONTH_SLUGS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'] as const
export const monthName = (i: number) => MONTH_SLUGS[i][0].toUpperCase() + MONTH_SLUGS[i].slice(1)

export interface MonthSummary { slug: string; index: number; name: string; count: number; workers: number; top: { employer: string; slug: string; workers: number } | null }

const sum = (rows: { workers: number | null }[]) => rows.reduce((s, n) => s + (n.workers ?? 0), 0)

export async function getYearNotices(): Promise<PublicNotice[]> {
  const start = Date.UTC(LAYOFF_YEAR, 0, 1)
  const end = Date.UTC(LAYOFF_YEAR + 1, 0, 1)
  return (await getPublicNotices().catch(() => [] as PublicNotice[])).filter((n) => n.noticeDate.getTime() >= start && n.noticeDate.getTime() < end)
}

/** Every month of the year up to the current one, with its notice count and largest filing. */
export async function getMonths(notices?: PublicNotice[]): Promise<MonthSummary[]> {
  const rows = notices ?? (await getYearNotices())
  const now = new Date()
  const last = now.getUTCFullYear() > LAYOFF_YEAR ? 11 : now.getUTCFullYear() < LAYOFF_YEAR ? -1 : now.getUTCMonth()
  const out: MonthSummary[] = []
  for (let i = 0; i <= last; i++) {
    const inMonth = rows.filter((n) => n.noticeDate.getUTCMonth() === i)
    const biggest = inMonth.filter((n) => n.workers).sort((a, b) => b.workers! - a.workers!)[0]
    out.push({
      slug: MONTH_SLUGS[i], index: i, name: monthName(i), count: inMonth.length, workers: sum(inMonth),
      top: biggest ? { employer: biggest.employer, slug: biggest.slug, workers: biggest.workers! } : null,
    })
  }
  return out
}

export function monthIndex(slug: string): number {
  return (MONTH_SLUGS as readonly string[]).indexOf(slug)
}

export interface EmployerTotal { slug: string; name: string; notices: number; workers: number }

/** Employers ranked by workers named (then notices) across the given notices. */
export function topEmployers(notices: PublicNotice[], limit: number): EmployerTotal[] {
  const by = new Map<string, EmployerTotal>()
  for (const n of notices) {
    const e = by.get(n.slug) ?? { slug: n.slug, name: n.employer, notices: 0, workers: 0 }
    e.notices++
    e.workers += n.workers ?? 0
    by.set(n.slug, e)
  }
  return [...by.values()].sort((a, b) => b.workers - a.workers || b.notices - a.notices).slice(0, limit)
}

export function byState(notices: PublicNotice[]): { state: string; notices: number; workers: number }[] {
  const by = new Map<string, { state: string; notices: number; workers: number }>()
  for (const n of notices) {
    const e = by.get(n.state) ?? { state: n.state, notices: 0, workers: 0 }
    e.notices++
    e.workers += n.workers ?? 0
    by.set(n.state, e)
  }
  return [...by.values()].sort((a, b) => b.workers - a.workers || b.notices - a.notices)
}
