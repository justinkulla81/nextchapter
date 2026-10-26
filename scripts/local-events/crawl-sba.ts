/* eslint-disable @typescript-eslint/no-explicit-any -- scraped markup */
// Reads sba.gov/events, the SBA's listing of its own, SBDC, SCORE, Women's Business Center and Veterans Business Outreach Center events.
// (score.org itself returns 403 to bots, so SCORE events come only through this listing.) robots.txt allows it; one request at a time, 1.2 s apart.
// Usage: set -a; . ./.env.local; set +a; npx tsx scripts/local-events/crawl-sba.ts --out=/tmp/sba.json [--post=<import url>]
import { writeFileSync } from 'node:fs'

const arg = (k: string, d = '') => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d
const OUT = arg('out'); const POST = arg('post'); const MAX_PAGES = Number(arg('pages', '150'))
const UA = 'NextChapterEventsBot/1.0 (+https://launchyournextchapter.com; justin@launchyournextchapter.com)'
const STATES: Record<string, string> = { Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY', 'District of Columbia': 'DC' }
const CODES = new Set(Object.values(STATES))

let last = 0
async function get(url: string): Promise<string | null> {
  const wait = last + 1200 - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  last = Date.now()
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en-US' }, signal: AbortSignal.timeout(20000) })
    return r.ok ? await r.text() : null
  } catch { return null }
}
const strip = (h: string) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)

function hostKind(host: string): string {
  if (/score/i.test(host)) return 'SCORE'
  if (/sbdc|small business development/i.test(host)) return 'SBDC'
  return 'SBDC' // women's business centers, VBOCs, SBA district offices: SBA resource partners, shown with the SBDC label
}

async function main() {
  const teasers: { id: string; title: string; start: string; end?: string; mode: string; cost?: string }[] = []
  for (let p = 0; p < MAX_PAGES; p++) {
    const html = await get(`https://www.sba.gov/events?page=${p}`)
    if (!html) break
    const rows = [...html.matchAll(/<div class="event-teaser[\s\S]*?(?=<div class="views-row">|<\/main>|$)/g)].map((m) => m[0])
    if (!rows.length) break
    for (const r of rows) {
      const id = r.match(/href="\/event\/(\d+)"/)?.[1]; const title = r.match(/data-test="eventTitle"><a[^>]*>([\s\S]*?)<\/a>/)?.[1]
      const times = [...r.matchAll(/<time datetime="([^"]+)"/g)].map((m) => m[1])
      if (!id || !title || !times.length) continue
      teasers.push({ id, title: strip(title), start: times[0], end: times.length > 2 ? times[times.length - 1] : times[2], mode: r.match(/event-teaser__location-type (\w+)/)?.[1] ?? 'in_person', cost: strip(r.match(/data-test="eventCost">([\s\S]*?)<\/div>/)?.[1] ?? '') || undefined })
    }
    if (p % 10 === 0) console.log(`page ${p}, ${teasers.length} events`)
  }
  console.log(`${teasers.length} listed`)
  const sources = new Map<string, any>(); const events: any[] = []
  for (const t of teasers) {
    const d = await get(`https://www.sba.gov/event/${t.id}`)
    if (!d) continue
    const loc = strip(d.match(/class="event-detail__location"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/)?.[1] ?? '')
    const host = strip(d.match(/event-detail__host-organizer"?[^>]*>([\s\S]*?)<\/div>\s*<\/div>/)?.[1] ?? '').replace(/^Host organization\s*/i, '').replace(/Type of event.*$/i, '').trim()
    const desc = strip(d.match(/data-test="eventDetails"[\s\S]*?<\/div>/)?.[0] ?? '').replace(/^Event description\s*/i, '').slice(0, 1500)
    const reg = d.match(/<a[^>]+href="([^"]+)"[^>]*data-test="registerButton"/)?.[1] ?? d.match(/data-test="registerButton"[^>]*href="([^"]+)"/)?.[1]
    const m = loc.match(/([A-Za-z.' -]+),\s*([A-Z]{2})\s*\d{5}/)
    let state = m && CODES.has(m[2]) ? m[2] : undefined
    const cm = loc.match(/(?:St\.?|Street|Ave\.?|Avenue|Rd\.?|Road|Blvd\.?|Boulevard|Hwy\.?|Highway|Dr\.?|Drive|Ln\.?|Lane|Way|Pkwy|Parkway|Ct\.?|Court|Pl\.?|Plaza|Loop|Cir\.?|Trail|Suite\s*\w+|Ste\.?\s*\w+|Floor|Fl\.?)\s+([A-Za-z][A-Za-z.' -]+?)\s*,\s*[A-Z]{2}\s*\d{5}/)
    const city = cm?.[1]?.replace(/^[NSEW]\.?\s+/, '').toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())
    if (!state) { const hit = Object.keys(STATES).find((n) => new RegExp(`\\b${n}\\b`).test(`${t.title} ${host} ${d.match(/data-test-district-office="([^"]*)"/)?.[1] ?? ''}`)); if (hit) state = STATES[hit] }
    if (!state) continue
    const hostName = host || 'SBA resource partner'
    const sid = `${hostKind(hostName)}:sba-${slug(hostName)}-${state}`
    sources.set(sid, { id: sid, kind: hostKind(hostName), name: hostName, state, city: city ?? null, website: 'https://www.sba.gov/events', eventsUrl: 'https://www.sba.gov/events', feedType: 'ld+json', eventCount: (sources.get(sid)?.eventCount ?? 0) + 1 })
    events.push({ title: t.title, description: desc, startsAt: t.start, endsAt: t.end, format: t.mode === 'online' ? 'VIRTUAL' : t.mode === 'hybrid' ? 'HYBRID' : 'IN_PERSON', venue: t.mode === 'online' ? undefined : loc.replace(/^Location\s*/i, '').slice(0, 160), city, state, url: `https://www.sba.gov/event/${t.id}`, registerUrl: reg && /^https?:/.test(reg) ? reg : undefined, cost: t.cost, sourceType: 'ld+json', sourceUrl: `https://www.sba.gov/event/${t.id}`, hostIds: [sid] })
    if (events.length % 50 === 0) console.log(`${events.length} detailed`)
  }
  console.log({ listed: teasers.length, events: events.length, hosts: sources.size })
  if (OUT) writeFileSync(OUT, JSON.stringify({ sources: [...sources.values()], events }, null, 1))
  if (POST) {
    const key = process.env.NC_ATS_API_KEY; if (!key) throw new Error('NC_ATS_API_KEY not set')
    const all = [...sources.values()]
    for (let o = 0; o < all.length; o += 300) await fetch(POST, { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ sources: all.slice(o, o + 300), events: [] }) })
    for (let o = 0; o < events.length; o += 50) {
      for (let a = 0; a < 6; a++) { const res = await fetch(POST, { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ events: events.slice(o, o + 50) }) }); if (res.ok) break; await new Promise((r) => setTimeout(r, 20000 * (a + 1))) }
    }
    console.log('posted')
  }
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
