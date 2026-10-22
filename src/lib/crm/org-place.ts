import 'server-only'
import { prisma } from '@/lib/prisma'
import { countyKey, placeKeys } from '@/lib/workforce/places'

export type PlaceBasis = 'college' | 'board' | 'directory' | 'headquarters' | 'job postings' | 'layoff filing' | 'state only'

export interface OrgPlace {
  state: string
  /** 5-digit county FIPS, which is also the GeoArea id; null when we only know the state. */
  fips: string | null
  countyName: string | null
  countyKey: string | null
  city: string | null
  basis: PlaceBasis
}

/** The county record for a county name in a state ("San Diego County", "CA"), read from the GeoArea list. */
async function countyByName(state: string, name: string): Promise<{ id: string; name: string } | null> {
  const key = countyKey(name)
  const rows = await prisma.geoArea.findMany({ where: { level: 'COUNTY', state }, select: { id: true, name: true } })
  return rows.find((r) => countyKey(r.name) === key) ?? null
}

async function countyByFips(fips: string): Promise<{ id: string; name: string; state: string } | null> {
  return prisma.geoArea.findUnique({ where: { id: fips }, select: { id: true, name: true, state: true } })
}

/** The county a city sits in: the job centers, colleges and organizations we hold there say so, then the Census place list when its county was already looked up. */
async function countyForCity(city: string, state: string): Promise<{ id: string; name: string } | null> {
  const [hit] = await prisma.$queryRaw<{ fips: string }[]>`
    select fips from (
      select "countyFips" fips from "AmericanJobCenter" where state = ${state} and lower(city) = lower(${city})
      union all select "countyFips" from "LocalCollege" where state = ${state} and lower(city) = lower(${city})
      union all select "countyFips" from "CollegeProfile" where state = ${state} and lower(city) = lower(${city})
    ) x where fips is not null group by fips order by count(*) desc limit 1`
  if (hit) { const c = await countyByFips(hit.fips); return c ? { id: c.id, name: c.name } : null }
  const places = await prisma.geoPlace.findMany({ where: { state, nameKey: { in: placeKeys(city) }, county: { not: null } }, orderBy: { population: 'desc' }, take: 1, select: { county: true } })
  return places[0]?.county ? countyByName(state, places[0].county) : null
}

const splitLocation = (loc: string): { city: string; state: string } | null => {
  const m = loc.match(/^(.+?),\s*([A-Z]{2})\b/)
  return m ? { city: m[1].trim(), state: m[2] } : null
}

/**
 * Where an organization sits, in the most exact way we can tell: its own college record, the workforce board or directory entry it is, its
 * headquarters, the cities its job postings name, or a layoff filing's county. Reads only what we hold; null when nothing places it.
 */
export async function resolveOrgPlace(orgId: string): Promise<OrgPlace | null> {
  const org = await prisma.crmOrganization.findUnique({ where: { id: orgId }, select: { name: true, companyId: true, hqCity: true, usState: true } })
  if (!org) return null
  const done = (state: string, c: { id: string; name: string } | null, basis: PlaceBasis, city: string | null = null): OrgPlace => ({
    state, fips: c?.id ?? null, countyName: c?.name ?? null, countyKey: c ? countyKey(c.name) : null, city, basis: c ? basis : 'state only',
  })

  const [college] = await prisma.$queryRaw<{ fips: string | null; state: string; city: string | null }[]>`
    select coalesce(l."countyFips", p."countyFips") fips, l.state, l.city from "LocalCollege" l left join "CollegeProfile" p on p.unitid = l.id
     where l."crmOrgId" = ${orgId} limit 1`
  if (college?.fips) { const c = await countyByFips(college.fips); if (c) return done(c.state, c, 'college', college.city) }

  // A college we hold under a slightly different record: the same name, or the university a school, college or center belongs to
  // ("University of Tampa - John H. Sykes College of Business", "The Johns Hopkins University School of Medicine").
  const parent = org.name.replace(/^the\s+/i, '').split(/\s+[-–]\s+/)[0].replace(/\s+(school|college|center|centre|institute|department|graduate school|business school)\s+(of|for|on)\b.*$/i, '').trim()
  const names = [...new Set([org.name, org.name.replace(/^the\s+/i, ''), parent])].filter((n) => n.length > 3)
  const [byName] = await prisma.$queryRaw<{ fips: string | null; state: string; city: string | null }[]>`
    select "countyFips" fips, state, city from "CollegeProfile" where lower(name) = any(${names.map((n) => n.toLowerCase())}) and "countyFips" is not null limit 1`
  if (byName?.fips) { const c = await countyByFips(byName.fips); if (c) return done(c.state, c, 'college', byName.city) }

  const [board] = await prisma.$queryRaw<{ state: string; counties: string[]; placeCounties: string[] }[]>`
    select state, counties, "placeCounties" from "WorkforceBoard" where lower(name) = lower(${org.name}) and statewide = false limit 1`
  if (board) {
    const key = board.counties[0] ?? board.placeCounties[0]
    if (key) {
      const rows = await prisma.geoArea.findMany({ where: { level: 'COUNTY', state: board.state }, select: { id: true, name: true } })
      const c = rows.find((r) => countyKey(r.name) === key)
      if (c) return done(board.state, c, 'board')
    }
  }

  const [lead] = await prisma.$queryRaw<{ geoAreaId: string | null; state: string; city: string | null }[]>`
    select "geoAreaId", state, city from "GeoOrgLead" where lower(name) = lower(${org.name}) and "geoAreaId" is not null limit 1`
  if (lead?.geoAreaId) { const c = await countyByFips(lead.geoAreaId); if (c) return done(c.state, c, 'directory', lead.city) }
  const [partner] = await prisma.$queryRaw<{ state: string; counties: string[] }[]>`
    select state, counties from "LocalPartnerOrg" where lower(name) = lower(${org.name}) and cardinality(counties) > 0 limit 1`
  if (partner) {
    const rows = await prisma.geoArea.findMany({ where: { level: 'COUNTY', state: partner.state }, select: { id: true, name: true } })
    const c = rows.find((r) => countyKey(r.name) === partner.counties[0])
    if (c) return done(partner.state, c, 'directory')
  }

  if (org.hqCity && org.usState && /^[A-Z]{2}$/.test(org.usState)) {
    const c = await countyForCity(org.hqCity, org.usState)
    return done(org.usState, c, 'headquarters', org.hqCity)
  }

  if (org.companyId) {
    // The biggest layoff filing's county, then the city its postings name most.
    const warn = await prisma.warnNotice.findFirst({ where: { companyId: org.companyId, dismissedAt: null, county: { not: null }, state: { not: null } }, orderBy: { noticeDate: 'desc' }, select: { state: true, county: true } })
    const profile = await prisma.companyHiringProfile.findUnique({ where: { companyId: org.companyId }, select: { topLocations: true, states: true } })
    const top = ((profile?.topLocations as { location: string; count: number }[] | null) ?? []).map((t) => ({ ...t, parsed: splitLocation(t.location) })).find((t) => t.parsed)
    if (top?.parsed) {
      const c = await countyForCity(top.parsed.city, top.parsed.state)
      if (c) return done(top.parsed.state, c, 'job postings', top.parsed.city)
    }
    if (warn?.state && warn.county) { const c = await countyByName(warn.state, warn.county); if (c) return done(warn.state, c, 'layoff filing') }
    if (top?.parsed) return done(top.parsed.state, null, 'state only', top.parsed.city)
    if (profile?.states.length === 1) return done(profile.states[0], null, 'state only')
  }
  if (org.usState && /^[A-Z]{2}$/.test(org.usState)) return done(org.usState, null, 'state only', org.hqCity)
  return null
}
