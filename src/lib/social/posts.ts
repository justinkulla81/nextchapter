import { SITE_URL } from '@/lib/seo/facts'
import { stateName } from '@/lib/seo/states'

export const WEEK_MS = 7 * 86_400_000
/** A quieter week than this is not worth a post. */
export const MIN_NOTICES = 10

export interface WeekNotice {
  state: string
  workers: number | null
  noticeDate: Date
}

export interface SocialPost {
  /** Stable id, so a post is never sent twice. */
  key: string
  text: string
}

const n = (v: number) => v.toLocaleString('en-US')

/** ISO week label, e.g. 2026-W44, from a UTC date. */
export function weekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1)
  return `${t.getUTCFullYear()}-W${String(Math.ceil(((t.getTime() - yearStart) / 86_400_000 + 1) / 7)).padStart(2, '0')}`
}

/**
 * The Monday post: last seven days of WARN layoff notices as totals, never employer names (employer-specific posts go
 * through the human-approved queue). Null when the week was too quiet.
 */
export function weeklyLayoffPost(notices: WeekNotice[], now: Date, utm: string): SocialPost | null {
  const cutoff = now.getTime() - WEEK_MS
  const prevCutoff = cutoff - WEEK_MS
  const thisWeek = notices.filter((x) => x.noticeDate.getTime() > cutoff && x.noticeDate.getTime() <= now.getTime())
  const lastWeek = notices.filter((x) => x.noticeDate.getTime() > prevCutoff && x.noticeDate.getTime() <= cutoff)
  if (thisWeek.length < MIN_NOTICES) return null
  const workers = thisWeek.reduce((s, x) => s + (x.workers ?? 0), 0)
  const byState = new Map<string, number>()
  for (const x of thisWeek) byState.set(x.state, (byState.get(x.state) ?? 0) + (x.workers ?? 0))
  const top = [...byState].sort((a, b) => b[1] - a[1]).slice(0, 3).filter(([, w]) => w > 0).map(([s]) => stateName(s))
  const diff = thisWeek.length - lastWeek.length
  const trend = lastWeek.length ? ` That is ${diff === 0 ? 'the same as' : `${n(Math.abs(diff))} ${diff > 0 ? 'more' : 'fewer'} than`} the week before.` : ''
  const text =
    `Layoff notices filed in the last 7 days: ${n(thisWeek.length)} WARN notices${workers ? ` naming ${n(workers)} workers` : ''}.${trend}` +
    (top.length ? ` Most workers: ${top.join(', ')}.` : '') +
    ` Free data, every notice: ${SITE_URL}/layoffs/this-week?${utm}`
  return { key: `layoffs-week-${weekKey(now)}`, text }
}
