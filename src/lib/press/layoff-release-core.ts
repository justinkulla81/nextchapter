/**
 * The monthly layoff release for reporters: pure logic, no database. Everything on the page is computed from the notices
 * handed in, counted the same way as /layoffs/2026/<month> (by the date on each filing), so a number quoted from the release
 * matches the month page, the CSV and the tracker.
 */
import type { PublicNotice } from '@/lib/warn/layoff-pages'

export const RELEASE_MIN_NOTICES = 10
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export interface ReleaseSlug { year: number; month: number; slug: string; label: string }

/** "2026-10" -> October 2026. Null for anything else. */
export function parseReleaseSlug(slug: string): ReleaseSlug | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(slug)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2]) - 1
  if (year < 2020 || year > 2100) return null
  return { year, month, slug, label: `${MONTHS[month]} ${year}` }
}

export const releaseSlugOf = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, '0')}`
export const monthNameOf = (month: number) => MONTHS[month]

interface Tally { notices: number; workers: number }
const tally = (rows: PublicNotice[]): Tally => ({ notices: rows.length, workers: rows.reduce((s, n) => s + (n.workers ?? 0), 0) })
const inMonth = (rows: PublicNotice[], year: number, month: number) => rows.filter((n) => n.noticeDate.getUTCFullYear() === year && n.noticeDate.getUTCMonth() === month)

export function pctChange(current: number, base: number): number | null {
  if (!base) return null
  return Math.round(((current - base) / base) * 100)
}

export interface Comparison { label: string; notices: number; workers: number; noticesPct: number | null; workersPct: number | null }

export interface Release {
  slug: string
  label: string
  year: number
  month: number
  partial: boolean
  notices: number
  workers: number
  /** Notices that state a headcount; the people total is a floor because some filings do not. */
  noticesWithHeadcount: number
  states: number
  topStates: StateTotal[]
  topEmployers: EmployerTotal[]
  largest: { employer: string; slug: string; state: string; workers: number } | null
  vsPrevious: Comparison | null
  vsLastYear: Comparison | null
  /** True when this month has the most notices of any month so far in its year (at least three months compared). */
  highestNoticesOfYear: boolean
  findings: string[]
  rows: PublicNotice[]
}

const n = (v: number) => v.toLocaleString('en-US')

export interface EmployerTotal { slug: string; name: string; notices: number; workers: number }
export interface StateTotal { state: string; notices: number; workers: number }

/** States ranked by notices, then people named. */
export function stateTotals(rows: PublicNotice[]): StateTotal[] {
  const by = new Map<string, StateTotal>()
  for (const r of rows) {
    const e = by.get(r.state) ?? { state: r.state, notices: 0, workers: 0 }
    e.notices++
    e.workers += r.workers ?? 0
    by.set(r.state, e)
  }
  return [...by.values()].sort((a, b) => b.notices - a.notices || b.workers - a.workers || a.state.localeCompare(b.state))
}

/** Employers ranked by people named, then notices. */
export function employerTotals(rows: PublicNotice[], limit: number): EmployerTotal[] {
  const by = new Map<string, EmployerTotal>()
  for (const r of rows) {
    const e = by.get(r.slug) ?? { slug: r.slug, name: r.employer, notices: 0, workers: 0 }
    e.notices++
    e.workers += r.workers ?? 0
    by.set(r.slug, e)
  }
  return [...by.values()].sort((a, b) => b.workers - a.workers || b.notices - a.notices || a.name.localeCompare(b.name)).slice(0, limit)
}

function compare(label: string, cur: Tally, base: Tally): Comparison {
  return { label, notices: base.notices, workers: base.workers, noticesPct: pctChange(cur.notices, base.notices), workersPct: pctChange(cur.workers, base.workers) }
}

const dir = (pct: number) => (pct > 0 ? `up ${pct}%` : pct < 0 ? `down ${Math.abs(pct)}%` : 'unchanged')

/**
 * The release for one month, from every notice on the public record (24 months). Null when the month has no notices.
 * The last-year comparison needs that month to sit wholly inside the data window, so a month near the edge gets none.
 */
export function buildRelease(all: PublicNotice[], year: number, month: number, now: Date = new Date()): Release | null {
  const rows = inMonth(all, year, month)
  if (!rows.length) return null
  const cur = tally(rows)
  const partial = now.getUTCFullYear() === year && now.getUTCMonth() === month
  const states = stateTotals(rows)
  const employers = employerTotals(rows, 10)
  const withWorkers = rows.filter((r) => r.workers)
  const big = [...withWorkers].sort((a, b) => b.workers! - a.workers!)[0]

  const prevDate = new Date(Date.UTC(year, month - 1, 1))
  const prevRows = inMonth(all, prevDate.getUTCFullYear(), prevDate.getUTCMonth())
  const vsPrevious = prevRows.length ? compare(`${MONTHS[prevDate.getUTCMonth()]} ${prevDate.getUTCFullYear()}`, cur, tally(prevRows)) : null

  const windowStart = now.getTime() - 2 * 365 * 86_400_000
  const lyStart = Date.UTC(year - 1, month, 1)
  const lyRows = lyStart >= windowStart ? inMonth(all, year - 1, month) : []
  const vsLastYear = lyRows.length ? compare(`${MONTHS[month]} ${year - 1}`, cur, tally(lyRows)) : null

  const sameYear = [...new Set(all.filter((x) => x.noticeDate.getUTCFullYear() === year).map((x) => x.noticeDate.getUTCMonth()))].filter((m) => m < month || (m === month))
  const others = sameYear.filter((m) => m !== month).map((m) => inMonth(all, year, m).length)
  const highestNoticesOfYear = !partial && sameYear.length >= 3 && others.every((c) => cur.notices > c)

  const label = `${MONTHS[month]} ${year}`
  const findings: string[] = []
  findings.push(`Employers filed ${n(cur.notices)} layoff ${cur.notices === 1 ? 'notice' : 'notices'} dated ${label}${cur.workers ? `, naming ${n(cur.workers)} people` : ''}, across ${states.length} ${states.length === 1 ? 'state' : 'states'}.`)
  if (vsPrevious && vsPrevious.noticesPct !== null) findings.push(`Notices were ${dir(vsPrevious.noticesPct)} from ${vsPrevious.label} (${n(vsPrevious.notices)} notices).`)
  if (vsLastYear && vsLastYear.noticesPct !== null) findings.push(`Against ${vsLastYear.label}, notices were ${dir(vsLastYear.noticesPct)} (${n(vsLastYear.notices)} notices).`)
  if (highestNoticesOfYear) findings.push(`${MONTHS[month]} had more notices than any earlier month of ${year}.`)
  if (states[0]) findings.push(`${states[0].state} had the most notices (${n(states[0].notices)}).`)
  if (big) findings.push(`The largest single filing named ${n(big.workers!)} people at ${big.employer} (${big.state}).`)

  return {
    slug: releaseSlugOf(year, month), label, year, month, partial,
    notices: cur.notices, workers: cur.workers, noticesWithHeadcount: withWorkers.length,
    states: states.length, topStates: states.slice(0, 10), topEmployers: employers,
    largest: big ? { employer: big.employer, slug: big.slug, state: big.state, workers: big.workers! } : null,
    vsPrevious, vsLastYear, highestNoticesOfYear, findings, rows,
  }
}

/** Months with a release: complete months (not the current one) with at least RELEASE_MIN_NOTICES notices, newest first. */
export function releaseMonths(all: PublicNotice[], now: Date = new Date()): ReleaseSlug[] {
  const seen = new Map<string, number>()
  for (const x of all) {
    const k = releaseSlugOf(x.noticeDate.getUTCFullYear(), x.noticeDate.getUTCMonth())
    seen.set(k, (seen.get(k) ?? 0) + 1)
  }
  const current = releaseSlugOf(now.getUTCFullYear(), now.getUTCMonth())
  return [...seen.entries()]
    .filter(([slug, c]) => slug !== current && c >= RELEASE_MIN_NOTICES && slug < current)
    .map(([slug]) => parseReleaseSlug(slug))
    .filter((s): s is ReleaseSlug => !!s)
    .sort((a, b) => (a.slug < b.slug ? 1 : -1))
}
