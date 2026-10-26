import 'server-only'
import { cache } from 'react'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { PUBLIC_JOB_LIVE_SQL, PUBLIC_JOB_STATIC_SQL } from '@/lib/jobs/public-job-page-server'
import { boardCountyKeys } from '@/lib/workforce/board-area'
import { countyKey } from '@/lib/workforce/places'
import { strictOrgKey } from '@/lib/crm/normalize'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { claimSlug } from '@/lib/org-claims/urls'
import { uniqueClaimSlugs } from '@/lib/org-claims/org'
import { getStateCityPlaces, getStateCounties, type County } from '@/lib/places/places'
import { employerSlug } from '@/lib/seo/employer-slug'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'

/** URL slug for a state or territory. */
export const areaSlug = (code: string): string => (isCollegeTerritory(code) ? territorySlug(code) : stateSlug(code))
/** Display name for a state or territory. */
export const areaName = (code: string): string => COLLEGE_TERRITORIES[code] ?? stateName(code)
const COLLEGE_AREAS = [...ALL_STATE_CODES, ...Object.keys(COLLEGE_TERRITORIES)]
import { getStateBoards, type PublicBoard } from '@/lib/seo/workforce-pages'
import { parseAiPrograms, type AiPrograms } from '@/lib/seo/college-bar'
import { COLLEGE_SLUG_RE, COLLEGE_TERRITORIES, collegeIndexable, collegePath, collegeSlugs, functionsForMajors, isCollegeTerritory, territorySlug, unitidFromSlug } from '@/lib/seo/college-bar'

// Public college pages (/higher-education/<state>/<college>): IPEDS and College Scorecard facts for the college, the
// job market in its county, the workforce board and American Job Centers that serve it, and peer colleges in its
// state. Only public figures from our own tables. Nothing from the CRM except the slug of the college's claim page,
// and no layoff data (owner rule: layoffs are never shown on a public page).

export interface CollegeFacts {
  unitid: string
  state: string
  name: string
  city: string | null
  zip: string | null
  countyFips: string | null
  website: string | null
  control: string | null
  level: string | null
  /** IPEDS Carnegie basic classification code, when we hold one. */
  carnegie: number | null
  enrollment: number | null
  annualAwards: number | null
  alumniReported: number | null
  tuitionInState: number | null
  tuitionOutState: number | null
  netPrice: number | null
  earnings6: number | null
  earnings10: number | null
  employedShare10: number | null
  completionRate: number | null
  hasExecEd: boolean | null
  hasRetraining: boolean | null
  topMajors: { field: string; share: number; awards: number }[]
  /** AI/data/robotics degrees and certificates (IPEDS program codes); null = not loaded for this college. */
  aiPrograms: AiPrograms | null
  dataYear: string | null
  updatedAt: Date
  crmOrgId: string | null
}

export interface CollegeListing extends CollegeFacts {
  slug: string
  indexable: boolean
  claimSlug: string | null
}

export interface LocalMarket {
  county: {
    name: string; slug: string; fips: string; unemploymentRate: number | null; unemploymentRatePrior: number | null; asOf: string | null; population: number | null
    medianHouseholdIncome: number | null; whiteCollarShare: number | null; wcUnemploymentEst: number | null
  }
  jobsOpen: number
  entryLevel: number
  noExperience: number
  aiSkill: number
  /** Open jobs in the functions that hire for this college's biggest fields of study. */
  matchedFunctions: { function: string; count: number }[]
  matchedFields: string[]
  topFunctions: { function: string; count: number }[]
  topEmployers: { name: string; openRoles: number; href: string | null }[]
}

export interface CollegePageData extends CollegeListing {
  stateName: string
  market: LocalMarket | null
  boards: { name: string; website: string | null; href: string }[]
  centers: { name: string; city: string | null; phone: string | null; hours: string | null; detailsUrl: string | null }[]
  peers: CollegeListing[]
}

const asMajors = (v: unknown): CollegeFacts['topMajors'] =>
  (Array.isArray(v) ? v : []).filter((m): m is CollegeFacts['topMajors'][number] => !!m && typeof m.field === 'string' && typeof m.share === 'number')

const outcomes = (c: CollegeFacts) => [c.completionRate, c.earnings6, c.earnings10, c.netPrice, c.employedShare10].filter((x) => x != null).length

/** Every CRM university, keyed the way college names are matched, for the claim slug. */
const universityOrgs = cache(async () => {
  const rows = await prisma.crmOrganization.findMany({
    where: { orgTypes: { has: 'UNIVERSITY' } },
    select: { id: true, name: true, canonicalNameNormalized: true },
  })
  const byId = new Map(rows.map((r) => [r.id, r]))
  const keyCount = new Map<string, number>()
  for (const r of rows) { const k = strictOrgKey(r.name, normalizeOrgName); keyCount.set(k, (keyCount.get(k) ?? 0) + 1) }
  const byKey = new Map<string, (typeof rows)[number]>()
  for (const r of rows) { const k = strictOrgKey(r.name, normalizeOrgName); if (keyCount.get(k) === 1) byKey.set(k, r) }
  return { byId, byKey }
})

/** The CRM organization behind a college: the one it is linked to, else the only university with the same name. */
export async function crmOrgForCollege(c: { name: string; crmOrgId: string | null }) {
  const { byId, byKey } = await universityOrgs()
  return (c.crmOrgId ? byId.get(c.crmOrgId) : undefined) ?? byKey.get(strictOrgKey(c.name, normalizeOrgName)) ?? null
}

/** All colleges in a state, one per IPEDS id (the Scorecard table first, the ranked table fills the rest). */
export const getStateCollegeListings = cache(async (state: string): Promise<CollegeListing[]> => {
  const [profiles, locals, orgs, links] = await Promise.all([
    prisma.collegeProfile.findMany({ where: { state } }),
    prisma.localCollege.findMany({ where: { state } }),
    universityOrgs(),
    // Until prisma/manual/2026-10-25-college-org-link.sql is applied the table is missing: fall back to name matching.
    prisma.collegeOrgLink.findMany({ where: { crmOrgId: { not: null } }, select: { unitid: true, crmOrgId: true } }).catch(() => []),
  ])
  const linkById = new Map(links.map((l) => [l.unitid, l.crmOrgId]))
  const localById = new Map(locals.map((l) => [l.id, l]))
  const facts: CollegeFacts[] = profiles.map((p) => {
    const l = localById.get(p.unitid)
    return {
      unitid: p.unitid, state, name: p.name, city: p.city ?? l?.city ?? null, zip: p.zip ?? l?.zip ?? null,
      countyFips: p.countyFips ?? l?.countyFips ?? null, website: p.website ?? l?.website ?? null,
      control: p.control, level: p.level, carnegie: l?.carnegie ?? null,
      enrollment: p.enrollment, annualAwards: p.annualAwards, alumniReported: p.alumniReported, tuitionInState: p.tuitionInState, tuitionOutState: p.tuitionOutState,
      netPrice: p.netPrice, earnings6: p.earnings6, earnings10: p.earnings10, employedShare10: p.employedShare10,
      completionRate: p.completionRate, hasExecEd: p.hasExecEd, hasRetraining: p.hasRetraining, topMajors: asMajors(p.topMajors),
      aiPrograms: parseAiPrograms(p.aiPrograms),
      dataYear: p.dataYear, updatedAt: p.updatedAt, crmOrgId: l?.crmOrgId ?? null,
    }
  })
  const seen = new Set(facts.map((f) => f.unitid))
  for (const l of locals) {
    if (seen.has(l.id)) continue
    const control = l.sector === 1 || l.sector === 4 ? 'Public' : l.sector === 2 || l.sector === 5 ? 'Private nonprofit' : l.sector ? 'Private for-profit' : null
    const level = l.sector ? ([1, 2, 3].includes(l.sector) ? '4-year' : [4, 5, 6].includes(l.sector) ? '2-year' : null) : null
    facts.push({
      unitid: l.id, state, name: l.name, city: l.city, zip: l.zip, countyFips: l.countyFips, website: l.website, control, level, carnegie: l.carnegie,
      enrollment: null, annualAwards: null, alumniReported: null, tuitionInState: null, tuitionOutState: null, netPrice: null, earnings6: null, earnings10: null,
      employedShare10: null, completionRate: null, hasExecEd: null, hasRetraining: null, topMajors: [], aiPrograms: null, dataYear: null, updatedAt: l.updatedAt, crmOrgId: l.crmOrgId,
    })
  }
  const slugs = collegeSlugs(facts.map((f) => ({ unitid: f.unitid, name: f.name, city: f.city })))
  const orgFor = (f: (typeof facts)[number]) => {
    const linked = linkById.get(f.unitid) ?? f.crmOrgId
    return (linked ? orgs.byId.get(linked) : undefined) ?? orgs.byKey.get(strictOrgKey(f.name, normalizeOrgName))
  }
  // A claim link goes only to an address that resolves to one organization (see uniqueClaimSlugs).
  const claimable = await uniqueClaimSlugs(facts.flatMap((f) => { const o = orgFor(f); const s = o ? claimSlug(o.canonicalNameNormalized) : null; return s ? [s] : [] }))
  return facts
    .map((f) => {
      const org = orgFor(f)
      return {
        ...f,
        slug: slugs.get(f.unitid)!,
        // Territories have no county job data, so their pages stay out of search results.
        indexable: !isCollegeTerritory(state) && collegeIndexable({ enrollment: f.enrollment, majors: f.topMajors.length, outcomes: outcomes(f), countyFips: f.countyFips }),
        claimSlug: ((s) => (s && claimable.has(s) ? s : null))(org ? claimSlug(org.canonicalNameNormalized) : null),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
})

const citySpellings = (name: string, key: string) => [...new Set([key, name.toLowerCase(), name.toLowerCase().replace(/\bsaint\b/g, 'st').replace(/\bst\.\s*/g, 'st ')])]

async function localMarket(state: string, county: County, majors: CollegeFacts['topMajors']): Promise<LocalMarket | null> {
  const places = (await getStateCityPlaces(state)).filter((p) => p.county === county.name)
  const spellings = [...new Set(places.flatMap((p) => citySpellings(p.name, p.key)))]
  if (spellings.length === 0) return null
  const where = Prisma.sql`WHERE ${PUBLIC_JOB_STATIC_SQL} AND ${PUBLIC_JOB_LIVE_SQL} AND "locationState" = ${state} AND lower("locationCity") = ANY(${spellings})`
  const [[tot], fns, emps] = await Promise.all([
    prisma.$queryRaw<{ n: number; entry: number; noexp: number; ai: number }[]>`
      SELECT count(*)::int AS n,
             count(*) FILTER (WHERE level = 'ENTRY_IC')::int AS entry,
             count(*) FILTER (WHERE 'no_experience_ok' = ANY("postingSignals"))::int AS noexp,
             count(*) FILTER (WHERE cardinality("aiSkillItems") > 0)::int AS ai
      FROM "ExclusiveJobPosting" ${where}`,
    prisma.$queryRaw<{ f: string; n: number }[]>`
      SELECT "targetFunction" AS f, count(*)::int AS n FROM "ExclusiveJobPosting" ${where} AND "targetFunction" IS NOT NULL
      GROUP BY 1 ORDER BY n DESC, f`,
    prisma.$queryRaw<{ name: string; n: number; cn: string | null; cid: string | null; linkable: boolean | null }[]>`
      SELECT g.name, g.n, c."canonicalNameNormalized" AS cn, c.id AS cid, (p."openNow" >= 3) AS linkable
      FROM (SELECT "companyName" AS name, "companyId" AS cid, count(*)::int AS n FROM "ExclusiveJobPosting" ${where} AND "companyName" !~* '^(confidential|undisclosed|stealth)'
            GROUP BY 1, 2 ORDER BY n DESC, name LIMIT 8) g
      LEFT JOIN "Company" c ON c.id = g.cid
      LEFT JOIN "CompanyHiringProfile" p ON p."companyId" = c.id
      ORDER BY g.n DESC, g.name`,
  ])
  const byFunction = new Map(fns.map((r) => [r.f, r.n]))
  const match = functionsForMajors(majors)
  return {
    county: {
      name: county.name, slug: county.slug, fips: county.fips, unemploymentRate: county.unemploymentRate, unemploymentRatePrior: county.unemploymentRatePrior,
      asOf: county.asOf, population: county.population, medianHouseholdIncome: county.medianHouseholdIncome, whiteCollarShare: county.whiteCollarShare,
      wcUnemploymentEst: county.wcUnemploymentEst,
    },
    jobsOpen: tot?.n ?? 0, entryLevel: tot?.entry ?? 0, noExperience: tot?.noexp ?? 0, aiSkill: tot?.ai ?? 0,
    matchedFunctions: match.functions.map((f) => ({ function: f, count: byFunction.get(f) ?? 0 })).filter((x) => x.count > 0),
    matchedFields: match.fields,
    topFunctions: fns.slice(0, 6).map((r) => ({ function: r.f, count: r.n })),
    topEmployers: emps.map((r) => ({ name: r.name, openRoles: r.n, href: r.linkable && r.cn && r.cid ? `/employers/${employerSlug(r.cn, r.cid)}` : null })),
  }
}

function boardServes(b: PublicBoard, county: County): boolean {
  const keys = boardCountyKeys(b)
  return keys === 'all' || keys.includes(countyKey(county.name).replace(/\s+/g, ''))
}

/** The page data for one college, or null when the address stands for no college. `canonicalSlug` differs from `slug` when the address is an older or id-only form. */
export async function getCollegePage(stateCode: string, slug: string): Promise<(CollegePageData & { canonicalSlug: string }) | null> {
  if (!COLLEGE_AREAS.includes(stateCode) || !COLLEGE_SLUG_RE.test(slug)) return null
  const list = await getStateCollegeListings(stateCode)
  const id = unitidFromSlug(slug)
  const c = list.find((x) => x.slug === slug) ?? (id ? list.find((x) => x.unitid === id) : undefined)
  if (!c) return null

  const counties = c.countyFips ? await getStateCounties(stateCode) : []
  const county = counties.find((x) => x.fips === c.countyFips) ?? null
  const [market, boards, centers] = await Promise.all([
    county ? localMarket(stateCode, county, c.topMajors) : Promise.resolve(null),
    county ? getStateBoards(stateCode) : Promise.resolve([]),
    c.countyFips ? prisma.americanJobCenter.findMany({ where: { countyFips: c.countyFips }, select: { name: true, city: true, phone: true, hours: true, detailsUrl: true }, orderBy: { name: 'asc' }, take: 6 }) : Promise.resolve([]),
  ])
  const peers = list
    .filter((x) => x.unitid !== c.unitid && x.control === c.control && x.level === c.level && x.enrollment != null)
    .sort((a, b) => Math.abs((a.enrollment ?? 0) - (c.enrollment ?? 0)) - Math.abs((b.enrollment ?? 0) - (c.enrollment ?? 0)) || a.name.localeCompare(b.name))
    .slice(0, 6)
  return {
    ...c,
    canonicalSlug: c.slug,
    stateName: stateCode,
    market,
    boards: county ? boards.filter((b) => boardServes(b, county)).map((b) => ({ name: b.name, website: b.website, href: `/workforce-boards/${areaSlug(stateCode)}/${b.slug}` })) : [],
    centers,
    peers,
  }
}

/** Every college that passes the page bar, for the sitemap and the llms.txt list. */
export async function indexableColleges(): Promise<{ state: string; slug: string; name: string; city: string | null; updatedAt: Date; control: string | null; level: string | null; enrollment: number | null }[]> {
  const out = []
  for (const state of ALL_STATE_CODES) {
    for (const c of await getStateCollegeListings(state)) {
      if (c.indexable) out.push({ state, slug: c.slug, name: c.name, city: c.city, updatedAt: c.updatedAt, control: c.control, level: c.level, enrollment: c.enrollment })
    }
  }
  return out
}

/** The public page of the college a CRM organization stands for, for the admin "Public page" link. */
export async function publicPageForOrg(org: { id: string; name: string; usState: string | null }): Promise<{ path: string; indexable: boolean } | null> {
  const linked = await prisma.localCollege.findFirst({ where: { crmOrgId: org.id }, select: { id: true, state: true } })
  const states = linked ? [linked.state] : org.usState && COLLEGE_AREAS.includes(org.usState) ? [org.usState] : []
  const key = strictOrgKey(org.name, normalizeOrgName)
  for (const state of states) {
    const list = await getStateCollegeListings(state)
    const hit = linked ? list.find((c) => c.unitid === linked.id) : list.filter((c) => strictOrgKey(c.name, normalizeOrgName) === key)[0]
    if (hit) return { path: collegePath(areaSlug(state), hit.slug), indexable: hit.indexable }
  }
  return null
}
