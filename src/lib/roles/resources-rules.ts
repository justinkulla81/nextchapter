// Rules for the "everything around a role" sections on a role page and for the member who holds that role. Pure: no I/O, so
// it is unit-tested (src/test/role-resources.test.ts). The loaders that read the database are in resources.ts.

import { ROLES, roleBySlug, rolesForTitle, type RoleDef } from '@/lib/seo/role-pages'

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
  /** Searches by `<function>|<band>`; absent on a listing stored before the field existed, which then lists no firm. */
  fnLevel?: Record<string, number>
}

/** Live searches a firm needs in the role's function at its level before it is called a specialist for it. */
export const MIN_FIRM_ROLE_SEARCHES = 2

/** A firm's live searches in the role's own function and level. */
export const firmSearchesForRole = (role: RoleDef, f: Pick<FirmLike, 'fnLevel'>): number => f.fnLevel?.[`${role.fn}|${firmBandForRole(role)}`] ?? 0

/**
 * Firms with at least MIN_FIRM_ROLE_SEARCHES live searches in the role's function at the role's level, most first. A firm with
 * hundreds of searches elsewhere (a hospitality staffing firm with one sales director search) does not make the list.
 */
export function firmsForRole<T extends FirmLike>(role: RoleDef, firms: T[], limit = 8): (T & { searches: number })[] {
  return firms
    .map((f) => ({ ...f, searches: firmSearchesForRole(role, f) }))
    .filter((f) => f.searches >= MIN_FIRM_ROLE_SEARCHES)
    .sort((a, b) => b.searches - a.searches || a.name.localeCompare(b.name))
    .slice(0, limit)
}

export interface ConfLike {
  name: string
  kind: string
  datesConfirmed: boolean
  startDate: Date | null
  seniorities: string[]
  roles: string[]
  importance: number
}

/** The level label a conference row uses for a role. */
export const conferenceSeniorityForRole = (role: RoleDef): 'EXECUTIVE' | 'SENIOR' => (role.level === 'c-suite' ? 'EXECUTIVE' : 'SENIOR')

/**
 * The conferences worth listing for a role: ones that have not started, built for the role's level (or for every level), the
 * ones that name the role first, then flagships, then the soonest. An event with no confirmed dates comes after the dated ones.
 * An event already under way, or one for other levels only, is left out.
 */
export function conferencesForRole<T extends ConfLike>(role: RoleDef, rows: T[], now = new Date(), limit = 6): T[] {
  const level = conferenceSeniorityForRole(role)
  const names = role.variants.map((v) => v.toLowerCase())
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const named = (c: ConfLike) => c.roles.some((r) => names.some((n) => r.toLowerCase().includes(n)))
  return rows
    .filter((c) => (c.seniorities.length === 0 || c.seniorities.includes(level)) && (!c.datesConfirmed || !c.startDate || c.startDate.getTime() > today))
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
