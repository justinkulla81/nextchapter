// Maps each published conference to the place pages of its city and county, for the conference page and the place pages' conference lists.
// Writes src/lib/events/conference-places.json: { <conferenceId>: { c?: <city slug, only when the city has a page>, cn?: <its name>, k?: <county slug>, kn?: <its name> } }.
// The state is not stored: it comes from the conference's own state code. Re-run when conferences are added or city pages change.
// Usage: set -a; . ./.env.local; set +a; npx tsx --conditions=react-server scripts/seo/build-conference-places.ts
import { writeFileSync } from 'node:fs'
import { prisma } from '../../src/lib/prisma'
import { getAllCounties, getStateCityPlaces } from '../../src/lib/places/places'
import { placeKey } from '../../src/lib/workforce/places'
import { ALL_STATE_CODES, stateSlug } from '../../src/lib/seo/states'

async function main() {
  const rows = await prisma.conferenceEvent.findMany({ where: { published: true, city: { not: null }, state: { in: ALL_STATE_CODES } }, select: { id: true, city: true, state: true } })
  // Which cities have a page: the live sitemap lists exactly those (getAllCityEntries needs the Next.js cache, which a script does not have).
  const xml = await (await fetch('https://launchyournextchapter.com/places/sitemap.xml')).text()
  const pages = new Set([...xml.matchAll(/\/places\/([a-z-]+)\/city\/([a-z0-9-]+)</g)].map((m) => `${m[1]}:${m[2]}`))
  if (pages.size < 1000) throw new Error(`sitemap lists only ${pages.size} city pages; refusing to write`)
  const counties = await getAllCounties()
  const out: Record<string, { c?: string; cn?: string; k?: string; kn?: string }> = {}
  for (const state of [...new Set(rows.map((r) => r.state!))].sort()) {
    const places = await getStateCityPlaces(state)
    const byKey = new Map(places.map((p) => [p.key, p]))
    const countyBy = new Map((counties.get(state) ?? []).map((c) => [c.name, c.slug]))
    for (const r of rows.filter((x) => x.state === state)) {
      const p = byKey.get(placeKey(r.city!))
      if (!p) continue
      const e: { c?: string; cn?: string; k?: string; kn?: string } = {}
      if (pages.has(`${stateSlug(state)}:${p.slug}`)) { e.c = p.slug; e.cn = p.name }
      const k = p.county ? countyBy.get(p.county) : undefined
      if (k) { e.k = k; e.kn = p.county! }
      if (e.c || e.k) out[r.id] = e
    }
  }
  const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(new URL('../../src/lib/events/conference-places.json', import.meta.url), JSON.stringify(sorted, null, 1) + '\n')
  console.log({ conferencesWithCityState: rows.length, withCityPage: Object.values(out).filter((e) => e.c).length, withCounty: Object.values(out).filter((e) => e.k).length })
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
