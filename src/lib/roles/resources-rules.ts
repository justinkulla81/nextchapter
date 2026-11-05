// Rules for the "everything around a role" sections on a role page and for the member who holds that role. Pure: no I/O, so
// it is unit-tested (src/test/role-resources.test.ts). The loaders that read the database are in resources.ts.

import { ROLES, ladderOf, roleBySlug, rolesForTitle, type RoleDef } from '@/lib/seo/role-pages'

/** The SEC officer code (src/lib/likely-openings/roles.ts) for each leadership role that has one. */
const OFFICER_BY_ROLE: Record<string, string> = {
  'chief-executive-officer': 'CEO',
  'chief-operating-officer': 'COO',
  'chief-financial-officer': 'CFO',
  'chief-revenue-officer': 'CRO',
  'chief-marketing-officer': 'CMO',
  'chief-product-officer': 'CPO',
  'chief-technology-officer': 'CTO',
  'chief-information-officer': 'CIO',
  'chief-human-resources-officer': 'CHRO',
  'general-counsel': 'GC',
  'chief-strategy-officer': 'CSO',
}

/** The top officer of a function, whose changes tell a VP or Director where the function is heading. */
const FUNCTION_HEAD: Record<string, string> = {
  Sales: 'CRO',
  Marketing: 'CMO',
  Engineering: 'CTO',
  Product: 'CPO',
  Finance: 'CFO',
  Operations: 'COO',
  'Human Resources': 'CHRO',
  'Customer Success': 'CRO',
  Legal: 'GC',
}

/**
 * A filing can name several officers ("the new CEO, who previously served as Chief Strategy Officer and Chief Commercial
 * Officer"). With more than one role on the row, a sentence that speaks of an earlier title is about another seat, not this one.
 */
export function isAboutSeat(summary: string, roles: readonly string[]): boolean {
  return roles.length <= 1 || !/\b(previously|formerly|former)\b/i.test(summary)
}

/** A source link is shown only when it is a plain https address. */
export const safeHttpsUrl = (url: string | null | undefined): string | null => (url && /^https:\/\/[^\s]+$/i.test(url) ? url : null)

export interface TurnoverScope {
  codes: string[]
  /** "CRO" for the role's own seat; "sales leadership" when a VP or Director reads the function head's changes. */
  label: string
  ownSeat: boolean
}

/** Which officer changes belong on a role's page. Null when the SEC filings name no officer for it. */
export function turnoverScope(role: RoleDef): TurnoverScope | null {
  const own = OFFICER_BY_ROLE[role.slug]
  if (own) return { codes: [own], label: role.short, ownSeat: true }
  const head = FUNCTION_HEAD[role.fn]
  if (role.level !== 'c-suite' && head) return { codes: [head], label: `${role.fn.toLowerCase()} leadership`, ownSeat: false }
  return null
}

/** The seniority band a search firm's listing uses (search-firm-bar SENIORITY_BANDS) for a role's level. */
export const firmBandForRole = (role: RoleDef): 'C-suite' | 'VP and director' => (role.level === 'c-suite' ? 'C-suite' : 'VP and director')

export interface FirmLike {
  orgId: string
  slug: string
  name: string
  /** A recruiting firm itself; an employer filed under staffing by its company industry is not. Absent on an older stored listing, which then lists no firm. */
  recruiter?: boolean
  /** Searches by `<function>|<band>`; absent on a listing stored before the field existed, which then lists no firm. */
  fnLevel?: Record<string, number>
}

/** A firm's live searches in the role's own function and level. */
export const firmSearchesForRole = (role: RoleDef, f: Pick<FirmLike, 'fnLevel'>): number => f.fnLevel?.[`${role.fn}|${firmBandForRole(role)}`] ?? 0

/** For a C-suite role: the same function one level below (VP and director), where firms that place its leaders also work. Other roles have none. */
export const adjacentSearchesForRole = (role: RoleDef, f: Pick<FirmLike, 'fnLevel'>): number => (role.level === 'c-suite' ? f.fnLevel?.[`${role.fn}|VP and director`] ?? 0 : 0)

/** Live searches a firm needs in the role's function at its level before it is called a specialist for it. */
export const MIN_FIRM_ROLE_SEARCHES = 2
/** Searches one level below that count when too few firms qualify at the role's own level. */
export const MIN_ADJACENT_SEARCHES = 3
/** A list shorter than this borrows from the level below. */
export const SHORT_FIRM_LIST = 4

/**
 * Recruiting firms (not employers filed under staffing) with at least MIN_FIRM_ROLE_SEARCHES live searches in the role's function
 * at its level, most first. A firm with hundreds of searches elsewhere (a hospitality staffing firm with one sales director search)
 * does not make the list. When fewer than SHORT_FIRM_LIST qualify for a C-suite role, firms with MIN_ADJACENT_SEARCHES searches one
 * level below follow, marked `adjacent`, so the page says what the count is.
 */
export function firmsForRole<T extends FirmLike>(role: RoleDef, firms: T[], limit = 8): (T & { searches: number; adjacent: boolean })[] {
  const recruiters = firms.filter((f) => f.recruiter === true)
  const exact = recruiters
    .map((f) => ({ ...f, searches: firmSearchesForRole(role, f), adjacent: false }))
    .filter((f) => f.searches >= MIN_FIRM_ROLE_SEARCHES)
    .sort((a, b) => b.searches - a.searches || a.name.localeCompare(b.name))
  if (exact.length >= SHORT_FIRM_LIST || role.level !== 'c-suite') return exact.slice(0, limit)
  const taken = new Set(exact.map((f) => f.slug))
  const next = recruiters
    .filter((f) => !taken.has(f.slug))
    .map((f) => ({ ...f, searches: adjacentSearchesForRole(role, f), adjacent: true }))
    .filter((f) => f.searches >= MIN_ADJACENT_SEARCHES)
    .sort((a, b) => b.searches - a.searches || a.name.localeCompare(b.name))
  return [...exact, ...next].slice(0, limit)
}

export interface ConfLike {
  name: string
  kind: string
  /** The event's own function tags; an event with none was matched only by inference and is not listed. */
  functions: string[]
  datesConfirmed: boolean
  startDate: Date | null
  seniorities: string[]
  roles: string[]
  importance: number
}

/** The level label a conference row uses for a role. */
export const conferenceSeniorityForRole = (role: RoleDef): 'EXECUTIVE' | 'SENIOR' => (role.level === 'c-suite' ? 'EXECUTIVE' : 'SENIOR')

/**
 * The conferences worth listing for a role: ones tagged for its function that have not started (one starting today still counts), built for the role's level (or
 * for every level), the ones that name the role or another role on its ladder (a CRO page counts "VP of Sales") first, then flagships, then the soonest. An event with no confirmed dates comes after the dated ones.
 * An event already under way, or one for other levels only, is left out.
 */
export function conferencesForRole<T extends ConfLike>(role: RoleDef, rows: T[], now = new Date(), limit = 6): T[] {
  const level = conferenceSeniorityForRole(role)
  const names = ladderOf(role).flatMap((r) => [r.short, r.spelled, ...r.variants]).concat(role.variants).map((v) => v.toLowerCase())
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  // Whole words only: "cro" must not match "microsoft" or "macro".
  const nameRes = [...new Set(names)].filter((n) => n.length >= 3).map((n) => new RegExp(`(?:^|[^a-z0-9])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-z0-9])`))
  const named = (c: ConfLike) => c.roles.some((r) => nameRes.some((re) => re.test(r.toLowerCase())))
  return rows
    .filter((c) => c.functions.includes(role.fn) && (c.seniorities.length === 0 || c.seniorities.includes(level)) && (!c.datesConfirmed || !c.startDate || c.startDate.getTime() >= today))
    .map((c) => ({ c, dated: c.datesConfirmed && !!c.startDate, named: named(c), tailored: c.seniorities.includes(level), trade: c.kind === 'TRADE_SHOW' }))
    .sort((a, b) =>
      Number(b.dated) - Number(a.dated) ||
      Number(b.named) - Number(a.named) ||
      Number(b.tailored) - Number(a.tailored) ||
      Number(a.trade) - Number(b.trade) ||
      a.c.importance - b.c.importance ||
      (a.c.startDate?.getTime() ?? 0) - (b.c.startDate?.getTime() ?? 0) ||
      a.c.name.localeCompare(b.c.name),
    )
    .slice(0, limit)
    .map((x) => x.c)
}

/**
 * The roles a member holds, from their latest résumé title and the title they are aiming for. Only leadership roles that have
 * a page can match, and a title counts only through the same rules the page counts listings by (role-pages.ts), so "CMO" at
 * a hospital is not marketing. At most two roles: the one held and the one aimed at.
 */
export function rolesForMember(titles: (string | null | undefined)[]): RoleDef[] {
  const out: RoleDef[] = []
  for (const t of titles) {
    if (!t) continue
    for (const r of rolesForTitle(t)) if (!out.some((o) => o.slug === r.slug)) out.push(r)
    if (out.length >= 2) break
  }
  return out.slice(0, 2)
}

export const allRoleSlugs = (): string[] => ROLES.map((r) => r.slug)
export const isRoleSlug = (slug: string): boolean => roleBySlug(slug) !== null
