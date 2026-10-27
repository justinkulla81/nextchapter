import 'server-only'
import { getCompanies, getPublicNotices, employerSlug, resolveCompanySlug, TWELVE_MONTHS_MS, type PublicNotice } from '@/lib/warn/layoff-pages'
import { strictOrgKey } from '@/lib/crm/normalize'
import type { OrgPage } from '@/lib/seo/org-pages'
import { normalizeOrgName } from '@/lib/text/org-name-match'

// The layoff notices an organization's page shows (owner decision 2026-10-27: notices belong on employer, job center, economic
// development, workforce board and college pages). Always the last twelve months, the same window the tracker indexes.

export interface PageNotices {
  items: PublicNotice[]
  total: number
  workers: number
}

const SHOWN = 8
const recent = (n: PublicNotice, now: number) => now - n.noticeDate.getTime() <= TWELVE_MONTHS_MS

function summarize(all: PublicNotice[]): PageNotices {
  return { items: all.slice(0, SHOWN), total: all.length, workers: all.reduce((s, n) => s + (n.workers ?? 0), 0) }
}

/** The notices in the workforce areas a job center, economic development organization or workforce board serves. */
export async function noticesForArea(state: string, boardIds: string[], statewide: boolean): Promise<PageNotices> {
  const now = Date.now()
  const ids = new Set(boardIds)
  const all = (await getPublicNotices()).filter((n) => n.state === state && recent(n, now) && (statewide || (n.board && ids.has(n.board.id))))
  return summarize(all)
}

/** The notices filed by one employer, in any state, by the company the tracker resolves its name to. */
export async function noticesForEmployer(name: string): Promise<PageNotices & { slug: string | null }> {
  const companies = await getCompanies()
  const slug = resolveCompanySlug(employerSlug(name, name), companies.keys())
  const now = Date.now()
  const all = slug ? (companies.get(slug)?.notices ?? []).filter((n) => recent(n, now)) : []
  return { ...summarize(all), slug }
}

/** A college is an employer too: notices whose employer is the college itself, in its state. */
export async function noticesForCollege(name: string, state: string): Promise<PageNotices> {
  const key = strictOrgKey(name, normalizeOrgName)
  const now = Date.now()
  const all = key ? (await getPublicNotices()).filter((n) => n.state === state && recent(n, now) && strictOrgKey(n.employer, normalizeOrgName) === key) : []
  return summarize(all)
}

/** The notices for an organization page: a board's own area, a job center's board, or the boards overlapping an economic development area. */
export function noticesForOrgPage(page: OrgPage): Promise<PageNotices> {
  const { row, area, blocks } = page
  const ids = row.kind === 'WORKFORCE_BOARD' ? [row.id] : row.boardId ? [row.boardId] : blocks.boards.map((b) => b.id)
  return noticesForArea(row.state, ids, area.statewide)
}
