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
  slug: string
  name: string
  functions: string[]
  seniorities: string[]
  publicRoles: number
}

/**
 * Firms whose live searches are in the role's function at the role's level. A firm with no clear specialty ("General": all
 * of functions and industries empty) never counts, so the list names specialists only.
 */
export function firmsForRole<T extends FirmLike>(role: RoleDef, firms: T[], limit = 8): T[] {
  const band = firmBandForRole(role)
  return firms
    .filter((f) => f.functions.includes(role.fn) && f.seniorities.includes(band))
    .sort((a, b) => b.publicRoles - a.publicRoles || a.name.localeCompare(b.name))
    .slice(0, limit)
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
