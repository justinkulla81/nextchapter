import 'server-only'
import { getPublicNotices, type PublicNotice } from '@/lib/warn/layoff-pages'
import { SITE_URL } from '@/lib/seo/facts'
import { ALL_STATE_CODES } from '@/lib/seo/states'
import { LAYOFF_DATA_CITATION, LAYOFF_DATA_LICENSE, LAYOFF_DATA_LICENSE_URL } from '@/lib/data/layoff-export'

// The one place that answers "what layoff notices match this employer, state and time window", shared by the public JSON API
// (/api/public/layoffs) and the MCP server's layoff tool, so an agent and a script get the same figures as the layoff pages.

export const LAYOFF_API_MAX_ROWS = 100
export const LAYOFF_API_MAX_DAYS = 365
const DAY_MS = 86_400_000

export interface LayoffQuery { state?: string | null; employer?: string | null; days?: number | null; limit?: number | null }

export interface ApiNotice {
  employer: string
  state: string
  place: string | null
  workers: number | null
  filedOn: string
  filedDateKnown: boolean
  effectiveOn: string | null
  type: string | null
  employerPage: string
  stateRecord: string | null
}

export interface LayoffAnswer {
  asOf: string
  count: number
  totalWorkers: number
  notices: ApiNotice[]
  license: string
  licenseUrl: string
  citation: string
  source: string
}

const iso = (d: Date) => d.toISOString().slice(0, 10)

/** A clean employer search term, as a slug and as lower-case words, so "Comcast", "comcast" and "Walt Disney" all work. */
function employerTerms(raw: string): { slug: string; words: string } {
  const words = raw.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()
  return { slug: words.replace(/\s+/g, '-'), words }
}

export function matchNotices(all: PublicNotice[], q: LayoffQuery, now = Date.now()): PublicNotice[] {
  const days = Math.min(Math.max(Math.floor(q.days ?? 30), 1), LAYOFF_API_MAX_DAYS)
  const state = (q.state ?? '').trim().toUpperCase()
  const emp = q.employer?.trim() ? employerTerms(q.employer) : null
  return all.filter((n) => {
    if (now - n.noticeDate.getTime() > days * DAY_MS || n.noticeDate.getTime() > now + DAY_MS) return false
    if (state && n.state !== state) return false
    if (emp && !(n.slug === emp.slug || n.slug.startsWith(emp.slug) || n.employer.toLowerCase().replace(/[^a-z0-9]+/g, ' ').includes(emp.words))) return false
    return true
  })
}

export function toAnswer(matches: PublicNotice[], limit: number, asOf = new Date()): LayoffAnswer {
  const rows = [...matches].sort((a, b) => b.noticeDate.getTime() - a.noticeDate.getTime() || (b.workers ?? 0) - (a.workers ?? 0)).slice(0, Math.min(Math.max(Math.floor(limit), 1), LAYOFF_API_MAX_ROWS))
  return {
    asOf: iso(asOf),
    count: matches.length,
    totalWorkers: matches.reduce((s, n) => s + (n.workers ?? 0), 0),
    notices: rows.map((n) => ({
      employer: n.employer,
      state: n.state,
      place: n.place,
      workers: n.workers,
      filedOn: iso(n.noticeDate),
      filedDateKnown: n.noticeDateKnown,
      effectiveOn: n.effectiveDate ? iso(n.effectiveDate) : null,
      type: n.type,
      employerPage: `${SITE_URL}/layoffs/company/${n.slug}`,
      stateRecord: n.sourceUrl && /^https:\/\//.test(n.sourceUrl) ? n.sourceUrl : null,
    })),
    license: LAYOFF_DATA_LICENSE,
    licenseUrl: LAYOFF_DATA_LICENSE_URL,
    citation: LAYOFF_DATA_CITATION,
    source: `${SITE_URL}/layoffs`,
  }
}

export const validState = (s: string | null | undefined) => !s || (ALL_STATE_CODES as readonly string[]).includes(s.trim().toUpperCase())

export async function queryLayoffs(q: LayoffQuery): Promise<LayoffAnswer> {
  return toAnswer(matchNotices(await getPublicNotices(), q), q.limit ?? 25)
}
