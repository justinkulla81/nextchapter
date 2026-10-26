// Rules for the public organization pages (American Job Centers, economic development organizations, workforce
// boards): the address of a page, the one place that decides whether a page is offered to search engines, and the
// name an organization gets in the CRM. Pure, so the sitemap, the page and the tests read the same rules.

export type OrgPageKind = 'JOB_CENTER' | 'ECON_DEV' | 'WORKFORCE_BOARD'

export const slugifyName = (s: string) =>
  s.toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/** "Morgan County Economic Development (listed by EDAA)" → "Morgan County Economic Development". */
export const cleanOrgName = (s: string) => s.replace(/\s*\((?:listed by|source:)[^)]*\)\s*$/i, '').replace(/\s+/g, ' ').trim()

/**
 * Page addresses within one state. A name is its own slug; two organizations that read the same get their city
 * added, and if that still clashes, their id. Stable as long as the names are: it never depends on row order.
 */
export function orgSlugs(rows: { id: string; name: string; city?: string | null }[]): Map<string, string> {
  const base = (r: { name: string }) => slugifyName(cleanOrgName(r.name)) || 'organization'
  const tally = (key: (r: { id: string; name: string; city?: string | null }) => string) => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1)
    return m
  }
  const byName = tally(base)
  const byNameCity = tally((r) => `${base(r)}|${slugifyName(r.city ?? '')}`)
  return new Map(
    rows.map((r) => {
      const name = base(r)
      if ((byName.get(name) ?? 0) <= 1) return [r.id, name]
      const city = slugifyName(r.city ?? '')
      if (city && (byNameCity.get(`${name}|${city}`) ?? 0) <= 1 && !name.includes(city)) return [r.id, `${name}-${city}`]
      return [r.id, `${name}-${slugifyName(r.id)}`]
    }),
  )
}

// ---------------------------------------------------------------------------------------------
// The content bar

/** Open public roles in the area a page serves, below which it has too little of its own to be indexed. */
export const ORG_PAGE_MIN_OPEN_JOBS = 5
/** Of the four extra blocks (entry-level roles, a college, another partner, local unemployment) a page needs this many. */
export const ORG_PAGE_MIN_EXTRA_BLOCKS = 2

export interface OrgPageFacts {
  /** Address, phone or website the source publishes for the organization. */
  hasIdentity: boolean
  /** The page can say which counties it serves (a statewide page counts: it serves the state). */
  hasArea: boolean
  jobsOpen: number
  entryLevelJobs: number
  colleges: number
  otherPartners: number
  hasLabor: boolean
}

export function extraBlocks(f: OrgPageFacts): number {
  return [f.entryLevelJobs > 0, f.colleges > 0, f.otherPartners > 0, f.hasLabor].filter(Boolean).length
}

/** The bar: a page below it still renders (people may reach it) but is `noindex` and left out of the sitemap. */
export function meetsOrgPageBar(f: OrgPageFacts): boolean {
  return f.hasIdentity && f.hasArea && f.jobsOpen >= ORG_PAGE_MIN_OPEN_JOBS && extraBlocks(f) >= ORG_PAGE_MIN_EXTRA_BLOCKS
}

// ---------------------------------------------------------------------------------------------
// CRM

/**
 * The name an organization is stored under in the CRM. The state is part of it because many of these names repeat
 * across states ("Career Center"), and the CRM keys organizations on the normalized name alone. A name that already
 * carries the state is left alone; a second organization of the same name in the state gets its city too.
 */
export function crmOrgName(row: { name: string; state: string; city?: string | null }, opts: { sameNameInState?: boolean } = {}): string {
  const name = cleanOrgName(row.name)
  const place = opts.sameNameInState && row.city ? `${row.city}, ${row.state}` : row.state
  return `${name} (${place})`
}

export const ORG_PAGE_ROOT: Record<OrgPageKind, string> = {
  JOB_CENTER: '/job-centers',
  ECON_DEV: '/economic-development',
  WORKFORCE_BOARD: '/workforce-boards',
}

export const orgPagePath = (kind: OrgPageKind, stateSlugValue: string, slug: string) => `${ORG_PAGE_ROOT[kind]}/${stateSlugValue}/${slug}`

/** URLs per organization sitemap file. */
export const ORG_SITEMAP_SHARD_SIZE = 2000

/** Pages to tell IndexNow about: indexable pages never announced, or whose lastmod moved since the last announcement. */
export function planOrgPageUpdates(current: { path: string; lastModified: string }[], announced: Record<string, string>): string[] {
  return current.filter((p) => announced[p.path] !== p.lastModified).map((p) => p.path)
}
