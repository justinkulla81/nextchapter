// Loads data/geo/areas.json + orgs.json (from build_geo.py) into GeoArea and
// GeoOrgLead, then derives layoff, WIOA-board and major-employer columns from
// WarnNotice and WorkforceBoard.
//
//   npx tsx scripts/geo/import-geo.ts            # dry run: reads, reports, writes nothing
//   npx tsx scripts/geo/import-geo.ts --apply    # writes (needs prisma/manual/geo-tables.sql applied first)
//
// Safe to re-run: GeoArea upserts by FIPS, GeoOrgLead by EIN. Hand-entered
// fields (initiatives, news, website, dismissedAt, crmOrganizationId) are never
// overwritten.
import 'dotenv/config'
import { readFileSync } from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { normalizeOrgName } from '../../src/lib/text/org-name-match'
import { cityFromAddress, placeKey } from '../../src/lib/workforce/places'

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')
const dir = path.join(process.cwd(), 'data', 'geo')

type Area = {
  fips: string; level: string; state: string; name: string
  population: number | null; laborForce: number | null
  unemploymentRate: number | null; unemploymentRatePrior: number | null; unemploymentAsOf: string | null
  medianHouseholdIncome: number | null; perCapitaIncome: number | null; whiteCollarShare: number | null
  wcUnemploymentEst: number | null; bcUnemploymentEst: number | null
  higherEdCount: number; higherEdEnrollmentEst: number; higherEd: unknown[]
  dataCenterCount: number; dataCenters: unknown[]
}
type Org = {
  ein: string; name: string; kind: string; street: string; city: string; state: string; zip: string
  county: string | null; revenue: number; assets: number; ntee: string | null; subsection: string; taxPeriod: string
}

const countyKey = (s: string) =>
  s.toLowerCase().replace(/\b(county|parish|borough|census area|municipality|city and borough)\b/g, '').replace(/[^a-z0-9]/g, '')

// ZIP -> county (largest land overlap), from the Census ZCTA file build_geo.py downloads.
function zipToCounty(): Map<string, string> {
  const best = new Map<string, [number, string]>()
  const lines = readFileSync(path.join(dir, 'zcta.txt'), 'utf8').replace(/^\uFEFF/, '').split('\n')
  const h = lines[0].split('|'); const zi = h.indexOf('GEOID_ZCTA5_20'), ci = h.indexOf('GEOID_COUNTY_20'), ai = h.indexOf('AREALAND_PART')
  for (const l of lines.slice(1)) {
    const c = l.split('|'); if (!c[zi] || !c[ci]) continue
    const a = Number(c[ai]) || 0
    if (a >= (best.get(c[zi])?.[0] ?? -1)) best.set(c[zi], [a, c[ci]])
  }
  return new Map([...best].map(([z, [, f]]) => [z, f]))
}

const int = (n: number | null) => (n == null ? null : Math.round(n))

async function main() {
  const { areas, builtAt } = JSON.parse(readFileSync(path.join(dir, 'areas.json'), 'utf8')) as { areas: Area[]; builtAt: string }
  const orgs = JSON.parse(readFileSync(path.join(dir, 'orgs.json'), 'utf8')) as Org[]

  // ── derived: layoffs ────────────────────────────────────────────────────
  const since12 = new Date(Date.now() - 365 * 864e5)
  const since90 = new Date(Date.now() - 90 * 864e5)
  const warn = await prisma.warnNotice.findMany({
    where: { dismissedAt: null, OR: [{ noticeDate: { gte: since12 } }, { effectiveDate: { gte: since12 } }] },
    select: { state: true, county: true, address: true, employer: true, employees: true, noticeDate: true, effectiveDate: true },
  })
  const z2c = zipToCounty()
  const places = await prisma.geoPlace.findMany({ where: { county: { not: null } }, select: { state: true, nameKey: true, county: true } })
  const placeCounty = new Map(places.map((p) => [`${p.state}|${p.nameKey}`, p.county as string]))
  const byFips = new Map(areas.map((a) => [a.fips, a]))
  const byCounty = new Map<string, Area>()
  for (const a of areas) if (a.level === 'COUNTY') byCounty.set(`${a.state}|${countyKey(a.name)}`, a)
  const derived = new Map<string, { w12: number; e12: number; w90: number; emp: Map<string, number> }>()
  const bump = (fips: string, w: number, recent: boolean, employer: string) => {
    const d = derived.get(fips) ?? { w12: 0, e12: 0, w90: 0, emp: new Map() }
    d.w12 += w; d.e12 += 1; if (recent) d.w90 += w
    d.emp.set(employer, (d.emp.get(employer) ?? 0) + w)
    derived.set(fips, d)
  }
  let unmatchedWarn = 0
  for (const n of warn) {
    if (!n.state) continue
    const w = n.employees ?? 0
    const recent = (n.noticeDate ?? n.effectiveDate ?? new Date(0)) >= since90
    // a filing can name several counties ("Jefferson, Oldham"); credit each.
    const names = (n.county ?? '').split(/[,;/&]| and /i).map((c) => countyKey(c)).filter(Boolean)
    let hit = names.map((c) => byCounty.get(`${n.state}|${c}`)).filter((a): a is Area => !!a)
    if (!hit.length && n.address) {
      const zip = n.address.match(/\b(\d{5})(?:-\d{4})?\s*$/)?.[1]
      const f = zip ? z2c.get(zip) : undefined
      if (f && byFips.has(f)) hit = [byFips.get(f)!]
    }
    if (!hit.length) {
      const city = cityFromAddress(n.address, n.state)
      const c = city ? placeCounty.get(`${n.state}|${placeKey(city)}`) : undefined
      const a = c ? byCounty.get(`${n.state}|${countyKey(c)}`) : undefined
      if (a) hit = [a]
    }
    if (!hit.length) { unmatchedWarn++; continue }
    for (const a of hit) bump(a.fips, Math.round(w / hit.length), recent, n.employer)
  }
  // state rollups = sum of their counties + notices with no matching county
  for (const st of areas.filter((a) => a.level === 'STATE')) {
    const d = { w12: 0, e12: 0, w90: 0, emp: new Map<string, number>() }
    for (const n of warn) {
      if (n.state !== st.state) continue
      const w = n.employees ?? 0
      d.w12 += w; d.e12 += 1
      if ((n.noticeDate ?? n.effectiveDate ?? new Date(0)) >= since90) d.w90 += w
      d.emp.set(n.employer, (d.emp.get(n.employer) ?? 0) + w)
    }
    derived.set(st.fips, d)
  }

  // ── derived: WIOA boards ────────────────────────────────────────────────
  const boards = await prisma.workforceBoard.findMany()
  const boardsFor = (a: Area) =>
    boards
      .filter((b) => b.state === a.state && (a.level === 'STATE' ? b.statewide : b.statewide || b.counties.some((c) => countyKey(c) === countyKey(a.name))))
      .sort((x, y) => Number(x.statewide) - Number(y.statewide))
      .map((b) => ({ id: b.id, name: b.name, website: b.website, directorName: b.directorName, directorTitle: b.directorTitle, directorEmail: b.directorEmail, directorPhone: b.directorPhone, statewide: b.statewide }))
  const boardNames = new Set(boards.map((b) => normalizeOrgName(b.name)))

  // ── report ──────────────────────────────────────────────────────────────
  const orgsOk = orgs.filter((o) => !boardNames.has(normalizeOrgName(o.name)))
  console.log(`areas ${areas.length} (counties with WARN data: ${[...derived.keys()].filter((k) => k.length === 5).length}; unmatched WARN rows ${unmatchedWarn}/${warn.length})`)
  console.log(`WIOA boards ${boards.length}; orgs ${orgs.length}, minus ${orgs.length - orgsOk.length} that are WIOA boards`)
  if (!apply) { console.log('dry run — pass --apply to write'); return }

  if (!process.argv.includes('--skip-areas')) {
  for (let i = 0; i < areas.length; i += 100) {
    await prisma.$transaction(
      areas.slice(i, i + 100).map((a) => {
        const d = derived.get(a.fips)
        const data = {
          level: a.level, state: a.state, name: a.name,
          population: int(a.population), laborForce: int(a.laborForce),
          unemploymentRate: a.unemploymentRate, unemploymentRatePrior: a.unemploymentRatePrior, unemploymentAsOf: a.unemploymentAsOf,
          medianHouseholdIncome: int(a.medianHouseholdIncome), perCapitaIncome: int(a.perCapitaIncome), whiteCollarShare: a.whiteCollarShare,
          wcUnemploymentEst: a.wcUnemploymentEst, bcUnemploymentEst: a.bcUnemploymentEst,
          higherEdCount: a.higherEdCount, higherEdEnrollmentEst: a.higherEdEnrollmentEst, higherEd: a.higherEd as object,
          dataCenterCount: a.dataCenterCount, dataCenters: a.dataCenters as object,
          wioaBoards: boardsFor(a) as object,
          layoffs12mo: d?.w12 ?? 0, layoffEvents12mo: d?.e12 ?? 0, layoffs90d: d?.w90 ?? 0,
          majorEmployers: d ? ([...d.emp.entries()].sort((x, y) => y[1] - x[1]).slice(0, 10).map(([employer, workers]) => ({ employer, workers })) as object) : undefined,
          dataBuiltAt: new Date(builtAt),
        }
        return prisma.geoArea.upsert({ where: { id: a.fips }, create: { id: a.fips, ...data }, update: data })
      }),
    )
  }
  }
  const have = new Set((await prisma.geoArea.findMany({ select: { id: true } })).map((a) => a.id))
  // Leads: bulk-insert the ones not there yet (fast). Existing rows are left alone unless --refresh,
  // so hand edits (website, dismissed, promoted to the CRM) are never overwritten.
  const existing = new Set((await prisma.geoOrgLead.findMany({ select: { ein: true } })).map((l) => l.ein))
  const row = (o: Org) => ({
    ein: o.ein, name: o.name, kind: o.kind, street: o.street || null, city: o.city || null, state: o.state, zip: o.zip || null,
    geoAreaId: o.county && have.has(o.county) ? o.county : null, revenue: o.revenue, assets: o.assets, ntee: o.ntee, subsection: o.subsection, taxPeriod: o.taxPeriod,
  })
  const fresh = orgsOk.filter((o) => !existing.has(o.ein))
  for (let i = 0; i < fresh.length; i += 1000) {
    await prisma.geoOrgLead.createMany({ data: fresh.slice(i, i + 1000).map(row), skipDuplicates: true })
    console.log(`inserted ${Math.min(i + 1000, fresh.length)}/${fresh.length}`)
  }
  if (process.argv.includes('--refresh')) {
    for (const o of orgsOk.filter((x) => existing.has(x.ein))) { const { ein: _e, ...data } = row(o); await prisma.geoOrgLead.update({ where: { ein: o.ein }, data }) }
  }
  console.log(`done: ${orgsOk.length} org leads on file (${fresh.length} new)`)
}

main().finally(() => prisma.$disconnect())
