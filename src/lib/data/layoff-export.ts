import { SITE_URL } from '@/lib/seo/facts'
import { stateFromSlug, stateName } from '@/lib/seo/states'
import { TWELVE_MONTHS_MS, TWENTY_FOUR_MONTHS_MS, getPublicNotices, type PublicNotice } from '@/lib/warn/layoff-pages'

// The WARN layoff record as a downloadable file: one row per filing, with the state's own source page and ours.
// Free to reuse with a link back (CC BY 4.0), which is the point: reporters, HR blogs and researchers cite what they can download.

export const LAYOFF_DATA_LICENSE = 'CC BY 4.0'
export const LAYOFF_DATA_LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/'
export const LAYOFF_DATA_CITATION = 'NextChapter layoff tracker, WARN Act notices collected from state labor departments. launchyournextchapter.com/layoffs'

export const LAYOFF_COLUMNS = ['state', 'employer', 'notice_date', 'effective_date', 'workers', 'layoff_type', 'place', 'source_url', 'nextchapter_url'] as const

export interface LayoffRow {
  state: string
  employer: string
  notice_date: string | null
  effective_date: string | null
  workers: number | null
  layoff_type: string | null
  place: string | null
  source_url: string | null
  nextchapter_url: string
}

const day = (d: Date) => d.toISOString().slice(0, 10)

export function toRow(n: PublicNotice): LayoffRow {
  return {
    state: n.state,
    employer: n.employer,
    notice_date: n.noticeDateKnown ? day(n.noticeDate) : null,
    effective_date: n.effectiveDate ? day(n.effectiveDate) : null,
    workers: n.workers,
    layoff_type: n.type,
    place: n.place,
    source_url: n.sourceUrl,
    nextchapter_url: `${SITE_URL}/layoffs/company/${n.slug}`,
  }
}

/** RFC 4180 field: quoted when it holds a comma, quote or line break; a leading = + - @ is neutralised so a spreadsheet never runs it as a formula. */
export function csvField(v: string | number | null): string {
  if (v === null || v === undefined) return ''
  let s = String(v)
  if (/^[=+\-@\t\r]/.test(s) && typeof v === 'string') s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: LayoffRow[]): string {
  const lines = [LAYOFF_COLUMNS.join(',')]
  for (const r of rows) lines.push(LAYOFF_COLUMNS.map((c) => csvField(r[c])).join(','))
  return `${lines.join('\r\n')}\r\n`
}

/** Two-letter code from "TX", "tx" or "texas"; null when it names no state. */
export function parseStateParam(v: string | null): string | null {
  if (!v) return null
  const t = v.trim()
  if (/^[A-Za-z]{2}$/.test(t)) return stateName(t.toUpperCase()) !== t.toUpperCase() ? t.toUpperCase() : null
  return stateFromSlug(t.toLowerCase().replace(/[^a-z]+/g, '-'))
}

/** Notices from the last 24 months, newest first, optionally one state. */
export async function getLayoffRows(state: string | null): Promise<LayoffRow[]> {
  const cutoff = Date.now() - TWENTY_FOUR_MONTHS_MS
  return (await getPublicNotices())
    .filter((n) => n.noticeDate.getTime() >= cutoff && (!state || n.state === state))
    .map(toRow)
}

/** Notices from the last 12 months in one state, newest first (the embed widget). */
export async function recentStateNotices(code: string): Promise<PublicNotice[]> {
  const cutoff = Date.now() - TWELVE_MONTHS_MS
  return (await getPublicNotices().catch(() => [])).filter((n) => n.state === code && n.noticeDate.getTime() >= cutoff)
}
