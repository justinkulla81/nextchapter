import 'server-only'
import { prisma } from '@/lib/prisma'
import { cityFromAddress, countyKey, placeKeys } from '@/lib/workforce/places'
import { pickBoard } from '@/lib/workforce/match'

/** One place a company operates, and how we know. */
export interface CompanyArea {
  areaId: string
  state: string
  county: string
  via: 'layoff-notice' | 'crm-headquarters' | 'job-posting' | 'company-hq'
  detail: string | null
}

export interface LocalPartners {
  area: { id: string; state: string; name: string }
  boards: { id: string; name: string; website: string | null; directorName: string | null; directorTitle: string | null; directorEmail: string | null; directorPhone: string | null; statewide: boolean }[]
  jobCenters: { id: string; name: string; centerType: string | null; city: string | null; phone: string | null; businessEmail: string | null; detailsUrl: string | null }[]
  districts: { id: string; name: string; website: string | null; contactName: string | null; contactTitle: string | null; email: string | null }[]
  stateAgency: { id: string; name: string; website: string | null; contactName: string | null; email: string | null; phone: string | null } | null
  localEdos: { id: string; name: string; kind: string; website: string | null; contactName: string | null; email: string | null; phone: string | null; revenue: number | null; confidence: string | null }[]
  universities: { name: string; city?: string | null; enrollment?: number | null; control?: string | null; nearby: boolean }[]
}

type CountyArea = { id: string; state: string; name: string }

async function countyArea(state: string, countyName: string): Promise<CountyArea | null> {
  const key = countyKey(countyName)
  const areas = await prisma.geoArea.findMany({ where: { level: 'COUNTY', state }, select: { id: true, state: true, name: true } })
  // Virginia's independent cities are "Norfolk city" in the Census list but "Norfolk" in a filing.
  return areas.find((a) => countyKey(a.name) === key) ?? areas.find((a) => countyKey(a.name.replace(/\s+city$/i, '')) === key) ?? null
}

/** The county a "City, ST" sits in, from the Census place list. */
async function countyForPlace(city: string, state: string): Promise<CountyArea | null> {
  const [place] = await prisma.geoPlace.findMany({ where: { state, nameKey: { in: placeKeys(city) } }, orderBy: { population: 'desc' }, take: 1 })
  return place?.county ? countyArea(state, place.county) : null
}

const CITY_STATE = /^([A-Za-z .'-]+),\s*([A-Z]{2})(?:,\s*(?:US|USA|United States))?$/

/**
 * Every county a company is known to operate in: its layoff notices (the
 * filing's county, else its address's city), its CRM headquarters, and the
 * "City, ST" locations on its job postings. Remote / "2 Locations" /
 * state-only postings name no county and are skipped.
 */
export async function areasForCompany(companyId: string): Promise<CompanyArea[]> {
  const out = new Map<string, CompanyArea>()
  const add = (a: CountyArea | null, via: CompanyArea['via'], detail: string | null) => {
    if (a && !out.has(a.id)) out.set(a.id, { areaId: a.id, state: a.state, county: a.name, via, detail })
  }
  const notices = await prisma.warnNotice.findMany({ where: { companyId, state: { not: null } }, select: { state: true, county: true, address: true }, take: 50 })
  for (const n of notices) {
    if (!n.state) continue
    if (n.county) { add(await countyArea(n.state, n.county), 'layoff-notice', n.address); continue }
    const city = cityFromAddress(n.address, n.state)
    if (city) add(await countyForPlace(city, n.state), 'layoff-notice', n.address)
  }
  const orgs = await prisma.crmOrganization.findMany({ where: { companyId }, select: { hqCity: true, usState: true }, take: 10 })
  for (const o of orgs) {
    if (o.hqCity && o.usState?.length === 2) add(await countyForPlace(o.hqCity, o.usState), 'crm-headquarters', `${o.hqCity}, ${o.usState}`)
  }
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } })
  if (company) {
    const postings = await prisma.exclusiveJobPosting.findMany({
      where: { companyName: { equals: company.name, mode: 'insensitive' }, archivedAt: null, location: { not: null } },
      select: { location: true }, distinct: ['location'], take: 40,
    })
    for (const p of postings) {
      const m = p.location?.trim().match(CITY_STATE)
      if (m) add(await countyForPlace(m[1], m[2]), 'job-posting', p.location)
    }
  }
  // Last resort: the headquarters a language model supplied (high/medium only).
  if (out.size === 0) {
    const [hq] = await prisma.$queryRaw<{ city: string | null; state: string | null }[]>`
      select city, state from "CompanyHq" where "companyId" = ${companyId} and confidence in ('high', 'medium') and state is not null limit 1`
    if (hq?.city && hq.state) add(await countyForPlace(hq.city, hq.state), 'company-hq', `${hq.city}, ${hq.state}`)
  }
  return [...out.values()]
}

/** The workforce board, job centers, EDA district, state agency, local EDOs and colleges for one county. */
export async function localPartnersForArea(areaId: string): Promise<LocalPartners | null> {
  const area = await prisma.geoArea.findUnique({ where: { id: areaId } })
  if (!area) return null
  const key = countyKey(area.name)
  const stateBoards = await prisma.workforceBoard.findMany({ where: { state: area.state } })
  const local = pickBoard(stateBoards, area.name, area.name.replace(/\s+(county|city)$/i, ''))
  const boards = [local, ...stateBoards.filter((b) => b.statewide && b.id !== local?.id)].filter((b): b is NonNullable<typeof b> => !!b)

  const countyCenters = await prisma.americanJobCenter.findMany({ where: { countyFips: area.id }, orderBy: [{ centerType: 'asc' }, { name: 'asc' }], take: 12 })
  const jobCenters = countyCenters.length
    ? countyCenters
    : local ? await prisma.americanJobCenter.findMany({ where: { workforceBoardId: local.id }, orderBy: { name: 'asc' }, take: 8 }) : []

  const [districts, agency, edos, leads] = await Promise.all([
    prisma.localPartnerOrg.findMany({ where: { kind: 'EDD', state: area.state, counties: { has: key } }, take: 3 }),
    prisma.localPartnerOrg.findFirst({ where: { kind: 'STATE_AGENCY', state: area.state } }),
    prisma.localPartnerOrg.findMany({ where: { kind: 'LOCAL_EDO', state: area.state, counties: { has: key } }, take: 10 }),
    prisma.geoOrgLead.findMany({ where: { geoAreaId: area.id, dismissedAt: null, kind: { in: ['ECON_DEV', 'WORKFORCE'] } }, orderBy: { revenue: 'desc' }, take: 8 }),
  ])

  const higher = (area.higherEd as { name: string; city?: string; enrollment?: number; control?: string }[] | null) ?? []
  let universities = higher.slice(0, 12).map((u) => ({ ...u, nearby: false }))
  if (universities.length === 0 && local?.counties.length) {
    // No campus in the county itself: the largest ones inside the same workforce area.
    const fips = await prisma.geoArea.findMany({ where: { state: area.state, level: 'COUNTY' }, select: { name: true, higherEd: true } })
    const inBoard = fips.filter((f) => local.counties.includes(countyKey(f.name)))
    universities = inBoard
      .flatMap((f) => ((f.higherEd as { name: string; city?: string; enrollment?: number; control?: string }[] | null) ?? []).map((u) => ({ ...u, nearby: true })))
      .sort((a, b) => (b.enrollment ?? 0) - (a.enrollment ?? 0))
      .slice(0, 8)
  }

  return {
    area: { id: area.id, state: area.state, name: area.name },
    boards: boards.map((b) => ({ id: b.id, name: b.name, website: b.website, directorName: b.directorName, directorTitle: b.directorTitle, directorEmail: b.directorEmail, directorPhone: b.directorPhone, statewide: b.statewide })),
    jobCenters: jobCenters.map((c) => ({ id: c.id, name: c.name, centerType: c.centerType, city: c.city, phone: c.phone, businessEmail: c.businessEmail, detailsUrl: c.detailsUrl })),
    districts: districts.map((d) => ({ id: d.id, name: d.name, website: d.website, contactName: d.contactName, contactTitle: d.contactTitle, email: d.email })),
    stateAgency: agency ? { id: agency.id, name: agency.name, website: agency.website, contactName: agency.contactName, email: agency.email, phone: agency.phone } : null,
    localEdos: [
      ...edos.map((e) => ({ id: e.id, name: e.name, kind: 'LOCAL_EDO', website: e.website, contactName: e.contactName, email: e.email, phone: e.phone, revenue: null, confidence: e.confidence })),
      ...leads.map((l) => ({ id: l.id, name: l.name, kind: l.kind, website: l.website, contactName: l.contactName, email: l.contactEmail, phone: l.contactPhone, revenue: l.revenue, confidence: l.contactConfidence })),
    ],
    universities,
  }
}
