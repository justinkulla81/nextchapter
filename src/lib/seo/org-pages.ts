import 'server-only'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { readJsonGz, STATE_BUCKET, writeJsonGz } from '@/lib/syndication/storage'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { PUBLIC_JOB_LIVE_SQL, PUBLIC_JOB_STATIC_SQL } from '@/lib/jobs/public-job-page-server'
import { boardCountyKeys } from '@/lib/workforce/board-area'
import { countyKey, placeKey } from '@/lib/workforce/places'
import { boardLabor, type BoardLabor } from '@/lib/workforce/labor'
import { getStateBoards } from '@/lib/seo/workforce-pages'
import { getStateCityPlaces, getStateCounties, type CityPlace, type County } from '@/lib/places/places'
import { employerSlug } from '@/lib/seo/employer-slug'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'
import { claimSlug } from '@/lib/org-claims/urls'
import {
  type OrgPageFacts, type OrgPageKind, cleanOrgName, meetsOrgPageBar, orgPagePath, orgSlugs,
} from '@/lib/seo/org-page-rules'

// Public pages for American Job Centers, economic development organizations and (extra sections for) workforce boards.
// Everything on them comes from tables we hold: the CareerOneStop and state-directory records for the organization
// itself, Census/BLS for its area, the live public job board for what is open there, IPEDS colleges and the other
// partner tables for who else serves it. Layoffs (WARN) are deliberately never read here: the owner decided on
// 2026-10-25 that no public page shows them.
//
// Contact details are the organization's own as the source publishes them: address, phone, hours, website and a
// general inbox. Named people (directors, contacts) and their emails are never exposed.

const keyOf = (k: string) => k.replace(/\s+/g, '')
const countyToken = (name: string) => keyOf(countyKey(name))

export interface OrgRow {
  kind: OrgPageKind
  id: string
  state: string
  name: string
  slug: string
  city: string | null
  /** "Comprehensive", "Affiliate", "Economic development district"… */
  label: string | null
  website: string | null
  street: string | null
  zip: string | null
  phone: string | null
  hours: string | null
  email: string | null
  countyFips: string | null
  detailsUrl: string | null
  /** A board's own service-area text ("Towns: Abington, Avon"). */
  serviceArea?: string | null
  /** County tokens the organization says it serves; 'all' = the whole state. */
  countyTokens: string[] | 'all'
  boardId: string | null
  updatedAt: Date
  sourceNote: string
}

export interface Area {
  statewide: boolean
  counties: County[]
  places: CityPlace[]
}

export interface OrgBlocks {
  jobsOpen: number
  entryLevel: number
  noExperience: number
  training: number
  newestJobAt: Date | null
  colleges: { id: string; name: string; city: string | null; sector: number | null; size: number | null; website: string | null }[]
  collegeCount: number
  centers: { id: string; name: string; city: string | null; slug: string; state: string }[]
  centerCount: number
  boards: { id: string; name: string; slug: string }[]
  partners: { id: string; name: string; kind: string; slug: string }[]
  labor: BoardLabor | null
  population: number | null
}

// ---------------------------------------------------------------------------------------------
// One state at a time: every row, the places and what the job board holds there.

interface CityStat { open: number; entry: number; noExp: number; training: number; newest: Date | null }
const zero = (): CityStat => ({ open: 0, entry: 0, noExp: 0, training: 0, newest: null })
const add = (a: CityStat, b: CityStat) => {
  a.open += b.open; a.entry += b.entry; a.noExp += b.noExp; a.training += b.training
  if (b.newest && (!a.newest || b.newest > a.newest)) a.newest = b.newest
}

const CENTER_LABEL = (t: string | null) => (t ? `${t} American Job Center` : 'American Job Center')
const EDO_LABEL: Record<string, string> = { EDD: 'Economic development district', LOCAL_EDO: 'Economic development organization', STATE_AGENCY: 'State economic development agency' }
const EDO_SOURCE: Record<string, string> = {
  EDA_EDD: 'U.S. Economic Development Administration list of Economic Development Districts',
  STATE_AGENCY_DIRECTORY: 'the state’s published agency directory',
  RESEARCH: 'the organization’s own public website',
}

export interface StateData {
  state: string
  centers: OrgRow[]
  econDev: OrgRow[]
  boards: OrgRow[]
  places: CityPlace[]
  counties: County[]
  cityStats: Map<string, CityStat>
  stateStat: CityStat
  collegesByFips: Map<string, OrgBlocks['colleges']>
  laborByToken: Map<string, { laborForce: number | null; unemployed: number | null; rateYearAgo: number | null; period: string | null }>
}

const jobsFrom = Prisma.sql`FROM "ExclusiveJobPosting" WHERE ${PUBLIC_JOB_STATIC_SQL} AND ${PUBLIC_JOB_LIVE_SQL}`
const ENTRY = Prisma.sql`"level" IN ('ENTRY_IC', 'EARLY_IC')`

export const getStateData = cache(async (state: string): Promise<StateData> => {
  const [centerRows, partnerRows, boardRows, places, counties, cityJobs, stateJobs, colleges, labor] = await Promise.all([
    prisma.americanJobCenter.findMany({ where: { state }, orderBy: [{ city: 'asc' }, { name: 'asc' }] }),
    prisma.localPartnerOrg.findMany({ where: { state }, orderBy: { name: 'asc' } }),
    getStateBoards(state),
    getStateCityPlaces(state),
    getStateCounties(state),
    prisma.$queryRaw<{ city: string; open: number; entry: number; noexp: number; training: number; newest: Date | null }[]>`
      SELECT lower("locationCity") AS city, count(*)::int AS open,
        count(*) FILTER (WHERE ${ENTRY})::int AS entry,
        count(*) FILTER (WHERE ${ENTRY} AND 'no_experience_ok' = ANY("postingSignals"))::int AS noexp,
        count(*) FILTER (WHERE ${ENTRY} AND 'training_provided' = ANY("postingSignals"))::int AS training,
        max("createdAt") AS newest
      ${jobsFrom} AND "locationState" = ${state} AND "locationCity" IS NOT NULL GROUP BY 1`,
    prisma.$queryRaw<{ open: number; entry: number; noexp: number; training: number; newest: Date | null }[]>`
      SELECT count(*)::int AS open, count(*) FILTER (WHERE ${ENTRY})::int AS entry,
        count(*) FILTER (WHERE ${ENTRY} AND 'no_experience_ok' = ANY("postingSignals"))::int AS noexp,
        count(*) FILTER (WHERE ${ENTRY} AND 'training_provided' = ANY("postingSignals"))::int AS training,
        max("createdAt") AS newest
      ${jobsFrom} AND "locationState" = ${state}`,
    prisma.localCollege.findMany({
      where: { state, sector: { in: [1, 2, 4, 5] } },
      select: { id: true, name: true, city: true, sector: true, size: true, website: true, countyFips: true },
      orderBy: [{ size: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
    }),
    prisma.countyLabor.findMany({ where: { state }, select: { nameKey: true, laborForce: true, unemployed: true, rateYearAgo: true, period: true } }),
  ])

  const cityStats = new Map<string, CityStat>()
  for (const r of cityJobs) {
    const k = placeKey(r.city)
    if (!k) continue
    add(cityStats.get(k) ?? cityStats.set(k, zero()).get(k)!, { open: r.open, entry: r.entry, noExp: r.noexp, training: r.training, newest: r.newest })
  }
  const s = stateJobs[0]
  const stateStat: CityStat = s ? { open: s.open, entry: s.entry, noExp: s.noexp, training: s.training, newest: s.newest } : zero()

  const collegesByFips = new Map<string, OrgBlocks['colleges']>()
  for (const c of colleges) if (c.countyFips) (collegesByFips.get(c.countyFips) ?? collegesByFips.set(c.countyFips, []).get(c.countyFips)!).push(c)

  const centerSlugs = orgSlugs(centerRows)
  const centers: OrgRow[] = centerRows.map((r) => ({
    kind: 'JOB_CENTER', id: r.id, state, name: cleanOrgName(r.name), slug: centerSlugs.get(r.id)!, city: r.city, label: CENTER_LABEL(r.centerType),
    website: null, street: r.street, zip: r.zip, phone: r.phone, hours: r.hours, email: r.generalEmail, countyFips: r.countyFips, detailsUrl: r.detailsUrl,
    countyTokens: [], boardId: r.workforceBoardId, updatedAt: r.updatedAt, sourceNote: 'CareerOneStop, U.S. Department of Labor',
  }))
  const partnerSlugs = orgSlugs(partnerRows)
  const econDev: OrgRow[] = partnerRows.map((r) => ({
    kind: 'ECON_DEV', id: r.id, state, name: cleanOrgName(r.name), slug: partnerSlugs.get(r.id)!, city: r.city, label: EDO_LABEL[r.kind] ?? 'Economic development organization',
    website: r.website, street: null, zip: null,
    // A phone only where an official directory published it; research-found numbers stay off the page.
    phone: r.source === 'RESEARCH' ? null : r.phone, hours: null, email: null, countyFips: null, detailsUrl: r.sourceUrl,
    countyTokens: r.kind === 'STATE_AGENCY' ? 'all' : r.counties.map(keyOf), boardId: null, updatedAt: r.updatedAt,
    sourceNote: EDO_SOURCE[r.source] ?? 'public directories',
  }))
  const boards: OrgRow[] = boardRows.map((b) => {
    const keys = boardCountyKeys(b)
    return {
      kind: 'WORKFORCE_BOARD', id: b.id, state, name: b.name, slug: b.slug, city: null, label: 'Workforce development board', website: b.website, street: null, zip: b.zip,
      phone: null, hours: null, email: null, countyFips: null, detailsUrl: null, countyTokens: keys, serviceArea: b.statewide ? null : b.serviceArea, boardId: b.id, updatedAt: new Date(0), sourceNote: 'CareerOneStop, U.S. Department of Labor',
    }
  })
  // Boards carry no updatedAt in the public shape; read it once for lastmod.
  const stamps = await prisma.workforceBoard.findMany({ where: { state }, select: { id: true, updatedAt: true, address: true } })
  const stamp = new Map(stamps.map((x) => [x.id, x]))
  for (const b of boards) { const x = stamp.get(b.id); if (x) { b.updatedAt = x.updatedAt; b.street = x.address } }

  return {
    state, centers, econDev, boards, places, counties, cityStats, stateStat, collegesByFips,
    laborByToken: new Map(labor.map((l) => [keyOf(l.nameKey), l])),
  }
})

// ---------------------------------------------------------------------------------------------
// Area and blocks for one organization

export function resolveArea(row: OrgRow, sd: StateData): Area {
  if (row.countyTokens === 'all') return { statewide: true, counties: [], places: [] }
  let counties: County[] = []
  if (row.kind === 'JOB_CENTER') {
    counties = sd.counties.filter((c) => c.fips === row.countyFips)
  } else {
    const tokens = new Set(row.countyTokens)
    counties = sd.counties.filter((c) => tokens.has(countyToken(c.name)))
  }
  const place = row.city ? sd.places.find((p) => p.key === placeKey(row.city!)) : undefined
  if (counties.length === 0 && place?.county) counties = sd.counties.filter((c) => c.name === place.county)
  const names = new Set(counties.map((c) => c.name))
  return { statewide: false, counties, places: sd.places.filter((p) => !!p.county && names.has(p.county)) }
}

export function areaStat(area: Area, sd: StateData): CityStat {
  if (area.statewide) return sd.stateStat
  const t = zero()
  for (const p of area.places) { const c = sd.cityStats.get(p.key); if (c) add(t, c) }
  return t
}

export function blocksFor(row: OrgRow, area: Area, sd: StateData): OrgBlocks {
  const stat = areaStat(area, sd)
  const fips = new Set(area.counties.map((c) => c.fips))
  const colleges = area.statewide ? [...sd.collegesByFips.values()].flat() : [...fips].flatMap((f) => sd.collegesByFips.get(f) ?? [])
  colleges.sort((a, b) => (b.size ?? 0) - (a.size ?? 0))
  const inArea = (r: OrgRow) => r.id !== row.id && (area.statewide || (!!r.countyFips && fips.has(r.countyFips)))
  const centers = sd.centers.filter(inArea)
  const tokens = new Set(area.counties.map((c) => countyToken(c.name)))
  const overlaps = (r: OrgRow) => r.countyTokens === 'all' || r.countyTokens.some((t) => tokens.has(t))
  const boards = area.statewide ? sd.boards : sd.boards.filter(overlaps)
  const partners = area.statewide ? [] : sd.econDev.filter((r) => r.id !== row.id && r.countyTokens !== 'all' && overlaps(r))
  const keys = [...tokens]
  const laborRows = area.statewide ? [...sd.laborByToken.values()] : keys.map((t) => sd.laborByToken.get(t)).filter((x): x is NonNullable<typeof x> => !!x)
  const population = area.counties.reduce<number | null>((s, c) => (c.population != null ? (s ?? 0) + c.population : s), null)
  return {
    jobsOpen: stat.open, entryLevel: stat.entry, noExperience: stat.noExp, training: stat.training, newestJobAt: stat.newest,
    colleges: colleges.slice(0, 8), collegeCount: colleges.length,
    centers: centers.slice(0, 12).map((c) => ({ id: c.id, name: c.name, city: c.city, slug: c.slug, state: c.state })), centerCount: centers.length,
    boards: boards.slice(0, 6).map((b) => ({ id: b.id, name: b.name, slug: b.slug })),
    partners: partners.slice(0, 10).map((p) => ({ id: p.id, name: p.name, kind: p.label ?? '', slug: p.slug })),
    labor: boardLabor(laborRows.map((l) => ({ laborForce: l.laborForce, unemployed: l.unemployed, rateYearAgo: l.rateYearAgo, period: l.period }))) as BoardLabor | null,
    population,
  }
}

export function factsFor(row: OrgRow, area: Area, b: OrgBlocks): OrgPageFacts {
  return {
    hasIdentity: !!(row.street || row.phone || row.website),
    hasArea: area.statewide || area.counties.length > 0,
    jobsOpen: b.jobsOpen,
    entryLevelJobs: b.entryLevel,
    colleges: b.collegeCount,
    otherPartners: b.centerCount + b.partners.length + (row.kind === 'WORKFORCE_BOARD' ? 0 : b.boards.length),
    hasLabor: !!b.labor,
  }
}

/** When the page's facts last changed: the organization's own record, or the newest job posted in its area. */
export const lastModified = (row: OrgRow, b: OrgBlocks): Date =>
  b.newestJobAt && b.newestJobAt > row.updatedAt ? b.newestJobAt : row.updatedAt

// ---------------------------------------------------------------------------------------------
// Page-only queries (not needed for the sitemap)

const citySpellings = (p: CityPlace) => [p.key, p.name.toLowerCase(), p.name.toLowerCase().replace(/\bsaint\b/g, 'st').replace(/\bst\.\s*/g, 'st ')]

export interface HiringEmployer { name: string; openRoles: number; href: string | null }
export interface AreaJob { id: string; title: string; company: string; location: string | null }

export async function areaHiring(state: string, area: Area): Promise<{ employers: HiringEmployer[]; jobs: AreaJob[] }> {
  if (!area.statewide && area.places.length === 0) return { employers: [], jobs: [] }
  const spellings = area.statewide ? null : [...new Set(area.places.flatMap(citySpellings))]
  const where = Prisma.sql`AND "locationState" = ${state} ${spellings ? Prisma.sql`AND lower("locationCity") = ANY(${spellings})` : Prisma.empty}`
  const [emp, jobs] = await Promise.all([
    prisma.$queryRaw<{ name: string; n: number; cn: string | null; cid: string | null; linkable: boolean | null }[]>`
      SELECT g.name, g.n, c."canonicalNameNormalized" AS cn, c.id AS cid, (p."openNow" >= 3) AS linkable
      FROM (SELECT "companyName" AS name, "companyId" AS cid, count(*)::int AS n ${jobsFrom} ${where} GROUP BY 1, 2 ORDER BY n DESC, name LIMIT 10) g
      LEFT JOIN "Company" c ON c.id = g.cid
      LEFT JOIN "CompanyHiringProfile" p ON p."companyId" = c.id
      ORDER BY g.n DESC, g.name`,
    prisma.$queryRaw<{ id: string; title: string; company: string; location: string | null }[]>`
      SELECT id, title, "companyName" AS company, location ${jobsFrom} ${where} ORDER BY "lastVerifiedAt" DESC NULLS LAST, id LIMIT 8`,
  ])
  return {
    employers: emp.map((r) => ({ name: r.name, openRoles: r.n, href: r.linkable && r.cn && r.cid ? `/employers/${employerSlug(r.cn, r.cid)}` : null })),
    jobs,
  }
}

/** The slug of the CRM organization's claim page, when the organization is linked to one. Fail-soft until the link table exists. */
export async function claimSlugFor(kind: OrgPageKind, sourceId: string): Promise<string | null> {
  try {
    const link = await prisma.publicOrgPage.findUnique({ where: { kind_sourceId: { kind, sourceId } }, select: { crmOrgId: true } })
    if (!link?.crmOrgId) return null
    const org = await prisma.crmOrganization.findUnique({ where: { id: link.crmOrgId }, select: { canonicalNameNormalized: true } })
    return org ? claimSlug(org.canonicalNameNormalized) : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------------------------
// Lookups, indexes and the sitemap list

export type OrgPage = { row: OrgRow; area: Area; blocks: OrgBlocks; facts: OrgPageFacts; indexable: boolean; lastModified: Date; stateData: StateData }

const rowsOf = (sd: StateData, kind: OrgPageKind) => (kind === 'JOB_CENTER' ? sd.centers : kind === 'ECON_DEV' ? sd.econDev : sd.boards)

export function buildOrgPage(row: OrgRow, sd: StateData): OrgPage {
  const area = resolveArea(row, sd)
  const blocks = blocksFor(row, area, sd)
  const facts = factsFor(row, area, blocks)
  return { row, area, blocks, facts, indexable: meetsOrgPageBar(facts), lastModified: lastModified(row, blocks), stateData: sd }
}

export async function getOrgPage(kind: OrgPageKind, stateSlugParam: string, slug: string): Promise<OrgPage | null> {
  const code = ALL_STATE_CODES.find((c) => stateSlug(c) === stateSlugParam)
  if (!code) return null
  const sd = await getStateData(code)
  const row = rowsOf(sd, kind).find((r) => r.slug === slug)
  return row ? buildOrgPage(row, sd) : null
}

export async function getStateOrgList(kind: OrgPageKind, stateSlugParam: string) {
  const code = ALL_STATE_CODES.find((c) => stateSlug(c) === stateSlugParam)
  if (!code) return null
  const sd = await getStateData(code)
  return { code, name: stateName(code), rows: rowsOf(sd, kind), stateData: sd }
}

export interface SitemapOrg { path: string; lastModified: Date }

async function loadStateWithRetry(code: string): Promise<StateData> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await getStateData(code)
    } catch (e) {
      if (attempt >= 3) throw e
      await new Promise((r) => setTimeout(r, 2000 * attempt))
    }
  }
}

export interface OrgPageSummary { pages: number; indexable: SitemapOrg[] }

/** Walks every state once and reports, for each kind, how many pages exist and which meet the bar (with address and lastmod). */
export async function summarizeOrgPages(): Promise<Record<OrgPageKind, OrgPageSummary>> {
  const out: Record<OrgPageKind, OrgPageSummary> = {
    JOB_CENTER: { pages: 0, indexable: [] }, ECON_DEV: { pages: 0, indexable: [] }, WORKFORCE_BOARD: { pages: 0, indexable: [] },
  }
  // Two states at a time: each load runs nine queries at once and the database pool is small (17), so more than that
  // starves the pool and loads time out; still fast enough to fit a serverless time limit.
  for (let i = 0; i < ALL_STATE_CODES.length; i += 2) {
    // A state that fails three times fails the whole walk: a partial list would be saved or cached as if it were complete.
    const loaded = await Promise.all(ALL_STATE_CODES.slice(i, i + 2).map(async (code) => ({ code, sd: await loadStateWithRetry(code) })))
    for (const { code, sd } of loaded) {
      for (const kind of ['JOB_CENTER', 'ECON_DEV', 'WORKFORCE_BOARD'] as const) {
        for (const row of rowsOf(sd, kind)) {
          out[kind].pages++
          const p = buildOrgPage(row, sd)
          if (p.indexable) out[kind].indexable.push({ path: orgPagePath(kind, stateSlug(code), row.slug), lastModified: p.lastModified })
        }
      }
    }
  }
  return out
}

/** Every page of a kind that meets the bar, with its address and lastmod: the sitemap's list. */
export async function indexableOrgPages(kind: OrgPageKind): Promise<SitemapOrg[]> {
  return (await summarizeOrgPages())[kind].indexable
}

const serialize = (all: Record<OrgPageKind, OrgPageSummary>) =>
  Object.fromEntries(Object.entries(all).map(([k, v]) => [k, { pages: v.pages, indexable: v.indexable.map((p) => ({ path: p.path, lastModified: p.lastModified.toISOString() })) }]))
type SavedSummary = Record<string, { pages: number; indexable: { path: string; lastModified: string }[] }>

const SUMMARY_PATH = 'org-pages/summary.json.gz'

/** Walks every state and saves the list where the sitemaps read it. The daily cron (indexnow-org-pages) calls this. */
export async function saveOrgPageSummary(): Promise<Record<OrgPageKind, OrgPageSummary>> {
  const all = await summarizeOrgPages()
  await writeJsonGz(STATE_BUCKET, SUMMARY_PATH, { v: 1, builtAt: new Date().toISOString(), summary: serialize(all) })
  return all
}

// Fallback when nothing has been saved yet (first deploy, or storage unavailable): walk the states, once per six hours.
const walkedSummary = unstable_cache(async () => serialize(await summarizeOrgPages()), ['org-pages-summary'], { revalidate: 21600 })

const savedSummary = unstable_cache(
  async (): Promise<SavedSummary | null> => (await readJsonGz<{ summary: SavedSummary }>(STATE_BUCKET, SUMMARY_PATH).catch(() => null))?.summary ?? null,
  ['org-pages-saved-summary'],
  { revalidate: 600 },
)

/** The sitemap list: the copy the daily cron saved (read in milliseconds), else a walk of the states. */
export async function cachedIndexableOrgPages(kind: OrgPageKind): Promise<SitemapOrg[]> {
  const all = (await savedSummary()) ?? ((await walkedSummary()) as SavedSummary)
  return all[kind].indexable.map((p) => ({ path: p.path, lastModified: new Date(p.lastModified) }))
}
