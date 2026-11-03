import { normalizeOrgName } from '@/lib/text/org-name-match'
import type { RankedCompany } from '@/lib/companies/company-ranking'

// Pure shaping for the What you follow page (src/app/dashboard/following). The loader (load.ts) reads the database;
// this file decides the group, the one verdict, its reason and the sort, so it can be tested without one.

export type FollowGroup = 'attention' | 'hiring' | 'quiet'
export type FollowSort = 'attention' | 'newest' | 'az'

export interface FollowRow {
  entryId: string
  name: string
  group: FollowGroup
  tone: 'warm' | 'good' | 'muted'
  verdict: string
  reason: string
  fact: string
  primary: { label: string; href: string }
  followedAt: string
}

export interface FollowInput {
  entry: { id: string; companyName: string; createdAt: Date }
  ranked: RankedCompany | null
  /** From the member's watchlist view: postings created since they last looked, and every open posting we match. */
  newOpenings: number
  openings: number
  /** /layoffs/company/<slug>; the loader builds it (employerSlug is server-only). */
  layoffHref: string
}

// A layoff filed in the last two months is what the member most needs to see; older ones stay in the quiet group.
const RECENT_LAYOFF_DAYS = 60

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
const day = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

export function companyHref(ranked: RankedCompany | null, name: string): string {
  return ranked ? `/dashboard/companies/${encodeURIComponent(ranked.company.canonicalNameNormalized)}` : `/dashboard/companies?q=${encodeURIComponent(name)}`
}

export function buildFollowRow({ entry, ranked, newOpenings, openings, layoffHref }: FollowInput): FollowRow {
  const name = entry.companyName
  const base = { entryId: entry.id, name, followedAt: entry.createdAt.toISOString() }
  const warn = ranked?.company.warn ?? null
  if (warn && warn.daysSinceMostRecent <= RECENT_LAYOFF_DAYS) {
    const filings = warn.filings12mo
    return {
      ...base,
      group: 'attention',
      tone: 'warm',
      verdict: warn.daysSinceMostRecent === 0 ? 'Layoff notice today' : `Layoff notice ${plural(warn.daysSinceMostRecent, 'day')} ago`,
      reason: `${warn.employeesAffected > 0 ? `${plural(warn.employeesAffected, 'worker')} named` : 'Worker count not published'} across ${plural(filings, 'filing')} in the last 12 months.`,
      fact: openings > 0 ? `${plural(openings, 'opening')} in our system.` : `You followed it ${day(entry.createdAt)}.`,
      primary: { label: 'See the layoff page', href: layoffHref },
    }
  }
  if (newOpenings > 0) {
    const fit = ranked && ranked.ranking.band !== 'long_shot' ? ranked.ranking.reasons[0] : null
    return {
      ...base,
      group: 'hiring',
      tone: ranked?.ranking.band === 'strong' ? 'good' : 'muted',
      verdict: `${plural(newOpenings, 'new opening')}`,
      reason: fit ?? 'Posted since you last looked at this company.',
      fact: `${plural(openings, 'opening')} in our system.`,
      primary: { label: `See ${plural(newOpenings, 'opening')}`, href: companyHref(ranked, name) },
    }
  }
  return {
    ...base,
    group: 'quiet',
    tone: 'muted',
    verdict: 'Nothing new',
    reason: openings > 0 ? `${plural(openings, 'opening')} in our system, none new since you last looked.` : 'No openings or layoff notices on file right now.',
    fact: `Followed ${day(entry.createdAt)}.`,
    primary: { label: 'See the company', href: companyHref(ranked, name) },
  }
}

const GROUP_ORDER: FollowGroup[] = ['attention', 'hiring', 'quiet']

export function sortFollowRows(rows: FollowRow[], sort: FollowSort): FollowRow[] {
  const byNewest = (a: FollowRow, b: FollowRow) => b.followedAt.localeCompare(a.followedAt) || a.name.localeCompare(b.name)
  const copy = [...rows]
  if (sort === 'az') return copy.sort((a, b) => a.name.localeCompare(b.name))
  if (sort === 'newest') return copy.sort(byNewest)
  return copy.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || byNewest(a, b))
}

export const parseSort = (v: string | undefined): FollowSort => (v === 'newest' || v === 'az' ? v : 'attention')

export interface Suggestion {
  companyId: string
  name: string
  reason: string
  fact: string
  href: string
}

/**
 * Companies the member does not follow yet, best fit first. Each one carries the reason the ranking found, so a company
 * with no stated reason is never suggested. Dismissed ones stay out.
 */
export function pickSuggestions(ranked: RankedCompany[], followedNames: Iterable<string>, dismissedIds: Set<string>, limit = 3): Suggestion[] {
  const followed = new Set([...followedNames].map((n) => normalizeOrgName(n)))
  const out: Suggestion[] = []
  for (const r of ranked) {
    if (out.length >= limit) break
    const c = r.company
    if (c.onWatchlist || followed.has(c.canonicalNameNormalized) || dismissedIds.has(c.id)) continue
    if (r.ranking.band === 'long_shot') continue
    const reason = r.ranking.reasons[0]
    if (!reason) continue
    out.push({
      companyId: c.id,
      name: c.name,
      reason,
      fact: c.signalOpenRoles != null && c.signalOpenRoles > 0 ? `${plural(c.signalOpenRoles, 'open role')}.` : c.hqMetro ? `Based in ${c.hqMetro}.` : '',
      href: companyHref(r, c.name),
    })
  }
  return out
}

// ── Groups: the communities a member belongs to (past employers, schools, field and place) ──

export type GroupSectionKey = 'employers' | 'schools' | 'together' | 'field'

export interface GroupRow {
  communityId: string
  label: string
  /** Why the member is in it, in words. */
  why: string
  /** Alumni networks can be rejoined; the others cannot, so leaving says so. */
  canRejoin: boolean
}

export const GROUP_SECTIONS: { key: GroupSectionKey; title: string }[] = [
  { key: 'employers', title: 'Past employers' },
  { key: 'schools', title: 'Schools' },
  { key: 'together', title: 'People laid off with you' },
  { key: 'field', title: 'Your field and place' },
]

const SECTION_OF: Record<string, GroupSectionKey> = { FORMER_EMPLOYER: 'employers', SCHOOL: 'schools', EX_COMPANY: 'together', FUNCTION: 'field', INDUSTRY: 'field', CITY: 'field' }

export function groupMemberships(
  memberships: { joinedVia: 'AUTO' | 'MANUAL'; community: { id: string; type: string; value: string; label: string } }[]
): { key: GroupSectionKey; title: string; rows: GroupRow[] }[] {
  const out = GROUP_SECTIONS.map((s) => ({ ...s, rows: [] as GroupRow[] }))
  for (const m of memberships) {
    const section = out.find((s) => s.key === SECTION_OF[m.community.type])
    if (!section) continue
    const alumni = m.community.type === 'SCHOOL' || m.community.type === 'FORMER_EMPLOYER'
    section.rows.push({
      communityId: m.community.id,
      label: m.community.label,
      why: alumni ? 'You joined this alumni network.' : m.joinedVia === 'AUTO' ? `Added because your profile says ${m.community.value}.` : 'You joined this group.',
      canRejoin: alumni,
    })
  }
  return out.filter((s) => s.rows.length > 0)
}
