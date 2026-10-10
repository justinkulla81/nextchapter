// Loads the local-partner data gathered for every county:
//   - re-keys WIOA board counties (De Kalb/DeKalb, Doña Ana, Miami-Dade) and adds
//     the county holes CareerOneStop leaves (listed in SUPPLEMENTS below)
//   - American Job Centers (data/geo/ajc.json, from scrape_ajc.py)
//   - EDA Economic Development Districts (data/geo/edd-raw.json, NADO's EDD layer)
//   - researched websites/contacts (data/geo/research/*-out-*.json, state-edo-*.json)
//
//   npx tsx scripts/geo/load-partners.ts            # dry run
//   npx tsx scripts/geo/load-partners.ts --apply    # writes (needs prisma/manual/geo-partners.sql applied)
import 'dotenv/config'
import { readFileSync, readdirSync, existsSync } from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { countyKey, areaPlaces } from '../../src/lib/workforce/places'
import { pickBoard } from '../../src/lib/workforce/match'

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')
const dir = path.join(process.cwd(), 'data', 'geo')
const read = <T>(f: string): T => JSON.parse(readFileSync(path.join(dir, f), 'utf8'))

/** County holes in CareerOneStop's own service-area text, confirmed against the state's board footprint. */
const SUPPLEMENTS: { state: string; board: RegExp; add: string[]; note: string }[] = [
  { state: 'FL', board: /CareerSource Gulf Coast/i, add: ['Bay'], note: 'Gulf Coast board serves Bay, Franklin, Gulf' },
  { state: 'SC', board: /Trident/i, add: ['Charleston'], note: 'Trident serves Berkeley, Charleston, Dorchester' },
  { state: 'MI', board: /Upper Peninsula/i, add: ['Keweenaw'], note: 'UP Michigan Works covers all 15 UP counties' },
  { state: 'NY', board: /New York City Workforce/i, add: ['Richmond'], note: 'NYC board covers Staten Island' },
  { state: 'MO', board: /Southeast Missouri/i, add: ['Dunklin'], note: 'Bootheel county; verify' },
  { state: 'MO', board: /South Central Workforce/i, add: ['Reynolds'], note: 'verify' },
  { state: 'TX', board: /Coastal Bend/i, add: ['Aransas'], note: 'Coastal Bend serves Aransas' },
  { state: 'HI', board: /Maui/i, add: ['Kalawao'], note: 'Kalawao is administered inside Maui County' },
]
/** Boards CareerOneStop lists with the state's name as their area but that are not statewide. */
const NOT_STATEWIDE = [/Hawai.i County Workforce/i]

async function main() {
  // ── 1. boards ──────────────────────────────────────────────────────────
  const boards = await prisma.workforceBoard.findMany()
  const fixed: { id: string; counties: string[]; statewide: boolean }[] = []
  for (const b of boards) {
    const countyPart = (b.serviceArea ?? '').split(';').map((s) => s.trim()).filter((s) => s && !/^(cities|city|towns?|townships?|municipalities|boroughs?):/i.test(s))
    const fromArea = countyPart.flatMap((s) => s.replace(/^(counties|county|parishes|parish):\s*/i, '').split(',')).map(countyKey).filter(Boolean)
    let counties = [...new Set(fromArea.length ? fromArea : b.counties.map(countyKey))]
    for (const s of SUPPLEMENTS) if (s.state === b.state && s.board.test(b.name)) counties = [...new Set([...counties, ...s.add.map(countyKey)])]
    const statewide = NOT_STATEWIDE.some((r) => r.test(b.name)) ? false : b.statewide
    if (JSON.stringify(counties) !== JSON.stringify(b.counties) || statewide !== b.statewide) fixed.push({ id: b.id, counties, statewide })
    b.counties = counties; b.statewide = statewide
  }
  console.log(`boards re-keyed/fixed: ${fixed.length} of ${boards.length}`)
  if (apply) for (const f of fixed) await prisma.workforceBoard.update({ where: { id: f.id }, data: { counties: f.counties, statewide: f.statewide } })

  // ── 2. American Job Centers ────────────────────────────────────────────
  const areas = await prisma.geoArea.findMany({ where: { level: 'COUNTY' }, select: { id: true, state: true, name: true } })
  const countyName = new Map(areas.map((a) => [a.id, a.name]))
  const z2c = new Map<string, string>()
  const best = new Map<string, number>()
  for (const line of readFileSync(path.join(dir, 'zcta.txt'), 'utf8').split('\n').slice(1)) {
    const c = line.split('|'); const z = c[1], fips = c[9], land = Number(c[16])
    if (!z || !fips || !(land > (best.get(z) ?? 0))) continue
    best.set(z, land); z2c.set(z, fips)
  }
  type Ajc = { id: string; centerId: string; name: string; type: string; state: string; street: string | null; city: string | null; zip: string | null; phone: string | null; hours: string | null; generalEmail: string | null; businessEmail: string | null; veteranEmail: string | null; youthEmail: string | null; detailsUrl: string }
  const ajcs = read<Ajc[]>('ajc.json')
  const boardsByState = new Map<string, typeof boards>()
  for (const b of boards) (boardsByState.get(b.state) ?? boardsByState.set(b.state, []).get(b.state)!).push(b)
  const ajcRows = ajcs.map((a) => {
    const fips = a.zip ? z2c.get(a.zip) ?? null : null
    const county = fips ? countyName.get(fips) ?? null : null
    const b = pickBoard(boardsByState.get(a.state) ?? [], county, a.city)
    return { id: a.id, centerId: a.centerId, name: a.name, centerType: a.type, state: a.state, street: a.street, city: a.city, zip: a.zip, countyFips: fips, phone: a.phone, hours: a.hours,
      generalEmail: a.generalEmail, businessEmail: a.businessEmail, veteranEmail: a.veteranEmail, youthEmail: a.youthEmail, detailsUrl: a.detailsUrl, workforceBoardId: b && !b.statewide ? b.id : b?.id ?? null }
  })
  console.log(`AJCs ${ajcRows.length}; with county ${ajcRows.filter((r) => r.countyFips).length}; with board ${ajcRows.filter((r) => r.workforceBoardId).length}; with business rep email ${ajcRows.filter((r) => r.businessEmail).length}`)

  // ── 3. EDA Economic Development Districts ──────────────────────────────
  type Edd = { OBJECTID: number; EDDname: string; Abbrev: string | null; State: string; City: string | null; Counties: string | null; ExDir: string | null; Contact: string | null; Website: string | null; CEDS_Link: string | null }
  const eddRaw = read<{ features: { attributes: Edd }[] }>('edd-raw.json').features.map((f) => f.attributes)
  const eddRows = eddRaw.filter((e) => e.State && e.State.length === 2 && e.State.toUpperCase() !== 'PR').map((e) => {
    const [name, ...title] = (e.ExDir ?? '').split(',').map((s) => s.trim())
    const counties = (e.Counties ?? '').replace(/^(City of .*? and )?(towns? of )?/i, '').split(/,| and /i).map((c) => countyKey(c.replace(/\bcounty\b/i, ''))).filter(Boolean)
    return { id: `edd-${e.OBJECTID}`, kind: 'EDD', name: e.EDDname.trim(), abbrev: e.Abbrev, state: e.State.toUpperCase(), city: e.City, counties: [...new Set(counties)], countiesText: e.Counties,
      website: e.Website, contactName: name || null, contactTitle: title.join(', ') || null, email: e.Contact && e.Contact.includes('@') ? e.Contact.trim() : null, phone: null,
      source: 'EDA_EDD', sourceUrl: e.CEDS_Link, confidence: 'high' }
  })
  console.log(`EDDs ${eddRows.length}; with email ${eddRows.filter((r) => r.email).length}; with website ${eddRows.filter((r) => r.website).length}`)

  // ── 4. researched websites / contacts ──────────────────────────────────
  const rdir = path.join(dir, 'research')
  type Out = { ein: string; website: string | null; contactName: string | null; contactTitle: string | null; email: string | null; phone: string | null; sourceUrl: string | null; confidence: string | null; note?: string | null }
  const enrich = new Map<string, Out>()
  if (existsSync(rdir)) for (const f of readdirSync(rdir).filter((f) => /^orgs-out-\d+(-part\d+)?\.json$/.test(f))) {
    for (const o of JSON.parse(readFileSync(path.join(rdir, f), 'utf8')) as Out[]) {
      if (!o?.ein || (o.confidence !== 'high' && o.confidence !== 'medium')) continue // snippet-only guesses (low) stay out
      if (!o.website && !o.contactName && !o.email) continue
      const cur = enrich.get(o.ein)
      const rank = (c: string | null) => ({ high: 3, medium: 2, low: 1 } as Record<string, number>)[c ?? ''] ?? 0
      if (!cur || rank(o.confidence) > rank(cur.confidence)) enrich.set(o.ein, o)
    }
  }
  console.log(`researched orgs with data: ${enrich.size}`)

  const stateEdoFiles = existsSync(rdir) ? readdirSync(rdir).filter((f) => /^state-edo-\d+\.json$/.test(f)) : []
  type StateFile = { states: Record<string, { stateAgency?: Record<string, string | null> | null; localEdos?: Record<string, string | null>[] }> }
  const stateRows: typeof eddRows = []
  for (const f of stateEdoFiles) {
    const j = JSON.parse(readFileSync(path.join(rdir, f), 'utf8')) as StateFile
    for (const [st, v] of Object.entries(j.states ?? {})) {
      const a = v.stateAgency
      if (a?.name) stateRows.push({ id: `state-${st}`, kind: 'STATE_AGENCY', name: a.name, abbrev: null, state: st, city: null, counties: [], countiesText: null, website: a.website ?? null,
        contactName: a.contactName ?? a.leaderName ?? null, contactTitle: a.contactTitle ?? a.leaderTitle ?? null, email: a.email ?? null, phone: a.phone ?? null, source: 'STATE_AGENCY_DIRECTORY', sourceUrl: a.sourceUrl ?? null, confidence: 'medium' })
      for (const [i, e] of (v.localEdos ?? []).entries()) {
        if (!e.name) continue
        stateRows.push({ id: `edo-${st}-${i}-${countyKey(e.name).slice(0, 24)}`, kind: 'LOCAL_EDO', name: e.name, abbrev: null, state: st, city: e.city ?? null,
          counties: e.county ? [countyKey(e.county)] : [], countiesText: e.county ?? null, website: e.website ?? null, contactName: e.contactName ?? null, contactTitle: e.contactTitle ?? null,
          email: e.email ?? null, phone: e.phone ?? null, source: 'STATE_AGENCY_DIRECTORY', sourceUrl: e.sourceUrl ?? null, confidence: 'low' })
      }
    }
  }
  console.log(`state agencies + local EDOs from research: ${stateRows.length}`)

  if (!apply) { console.log('dry run — pass --apply to write'); return }
  // Both tables are wholly derived from the files above, so replace them in bulk.
  await prisma.americanJobCenter.deleteMany({})
  await prisma.americanJobCenter.createMany({ data: ajcRows, skipDuplicates: true })
  await prisma.localPartnerOrg.deleteMany({})
  await prisma.localPartnerOrg.createMany({ data: [...eddRows, ...stateRows], skipDuplicates: true })
  let n = 0
  for (const [ein, o] of enrich) {
    const r = await prisma.geoOrgLead.updateMany({ where: { ein }, data: { website: o.website ?? undefined, contactName: o.contactName ?? undefined, contactTitle: o.contactTitle ?? undefined,
      contactEmail: o.email ?? undefined, contactPhone: o.phone ?? undefined, contactSource: o.sourceUrl ?? undefined, contactConfidence: o.confidence ?? undefined, enrichedAt: new Date() } })
    n += r.count
  }
  console.log(`written: AJC ${ajcRows.length}, partner orgs ${eddRows.length + stateRows.length}, enriched leads ${n}`)
}
main().finally(() => prisma.$disconnect())
