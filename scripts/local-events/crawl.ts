/* eslint-disable @typescript-eslint/no-explicit-any -- scraped JSON and ad-hoc SQL rows have no schema */
// Reads the events pages of chambers, workforce boards, economic-development orgs, state agencies and colleges and imports upcoming job fairs,
// hiring events, career workshops and business / entrepreneurship events. No model calls: structured data only (schema.org Event JSON-LD,
// The Events Calendar REST API, iCal and RSS feeds). Politeness: one request at a time per host (a 24-thread probe once got our IP blocked).
//
// Usage (reads sources from the DB, read-only):
//   set -a; . ./.env.local; set +a
//   npx tsx scripts/local-events/crawl.ts --kinds=WORKFORCE_BOARD,ECON_DEV,CHAMBER,COLLEGE --limit=200 --out=/tmp/local-events.json
//   NC_ATS_API_KEY=... npx tsx scripts/local-events/crawl.ts --post=https://launchyournextchapter.com/api/admin/local-events/import --kinds=...
import { readFileSync, writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

const arg = (k: string, d = '') => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d
const KINDS = arg('kinds', 'WORKFORCE_BOARD,ECON_DEV,CHAMBER,COLLEGE,STATE_AGENCY').split(',')
const LIMIT = Number(arg('limit', '100000'))
const STATES = arg('states') ? arg('states').split(',') : null
const OUT = arg('out')
const POST = arg('post')
const HORIZON_DAYS = 150
const UA = 'NextChapterEventsBot/1.0 (+https://launchyournextchapter.com; justin@launchyournextchapter.com)'
const db = new PrismaClient()

interface Src { id: string; kind: string; name: string; state: string; city: string | null; county: string | null; website: string }
interface Ev { title: string; description?: string; startsAt: string; endsAt?: string; format?: string; venue?: string; city?: string; state?: string; url?: string; registerUrl?: string; cost?: string; sourceType: string; sourceUrl: string; hostIds: string[] }

const cleanUrl = (w: string) => { try { const u = new URL(/^https?:/i.test(w) ? w : `https://${w}`); return u.origin } catch { return null } }

async function loadSources(): Promise<Src[]> {
  const out: Src[] = []
  const first = (c: string[] | null | undefined) => c?.[0] ?? null
  if (KINDS.includes('WORKFORCE_BOARD')) for (const r of await db.$queryRawUnsafe<any[]>(`select id, name, state, website, counties from "WorkforceBoard" where website is not null`)) out.push({ id: `WORKFORCE_BOARD:${r.id}`, kind: 'WORKFORCE_BOARD', name: r.name, state: r.state, city: null, county: first(r.counties), website: r.website })
  if (KINDS.includes('ECON_DEV') || KINDS.includes('STATE_AGENCY')) for (const r of await db.$queryRawUnsafe<any[]>(`select id, kind, name, state, city, website, counties from "LocalPartnerOrg" where website is not null`)) {
    const k = r.kind === 'STATE_AGENCY' ? 'STATE_AGENCY' : 'ECON_DEV'
    if (KINDS.includes(k)) out.push({ id: `${k}:${r.id}`, kind: k, name: r.name, state: r.state, city: r.city, county: first(r.counties), website: r.website })
  }
  if (KINDS.includes('CHAMBER')) for (const r of await db.$queryRawUnsafe<any[]>(`select g.id, g.name, g.state, g.city, g.website, a.name as county from "GeoOrgLead" g left join "GeoArea" a on a.id = g."geoAreaId" where g.kind = 'CHAMBER' and g.website is not null and g."dismissedAt" is null`)) out.push({ id: `CHAMBER:${r.id}`, kind: 'CHAMBER', name: r.name, state: r.state, city: r.city, county: r.county, website: r.website })
  if (KINDS.includes('COLLEGE')) for (const r of await db.$queryRawUnsafe<any[]>(`select id, name, state, city, website from "LocalCollege" where website is not null`)) out.push({ id: `COLLEGE:${r.id}`, kind: 'COLLEGE', name: r.name, state: r.state, city: r.city, county: null, website: r.website })
  // City governments (Wikidata, towns over 25,000 people): data/local-events/city-sources.json.
  if (KINDS.includes('CITY')) for (const c of JSON.parse(readFileSync(new URL('../../data/local-events/city-sources.json', import.meta.url), 'utf8')) as { name: string; state: string; website: string }[]) out.push({ id: `CITY:${c.state}-${c.name}`, kind: 'CITY', name: `City of ${c.name}`, state: c.state, city: c.name, county: null, website: c.website })
  return out.filter((s) => cleanUrl(s.website) && (!STATES || STATES.includes(s.state))).slice(0, LIMIT)
}

// One request at a time per host, spaced 1.2 s.
const lastHit = new Map<string, number>()
const chain = new Map<string, Promise<unknown>>()
function politeFetch(url: string, accept = 'text/html,application/xhtml+xml,application/json,text/calendar,application/rss+xml'): Promise<{ ok: boolean; status: number; type: string; text: string } | null> {
  const host = new URL(url).host
  const run = async () => {
    const wait = (lastHit.get(host) ?? 0) + 1200 - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastHit.set(host, Date.now())
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA, accept }, redirect: 'follow', signal: AbortSignal.timeout(15000) })
      const type = res.headers.get('content-type') ?? ''
      const text = (await res.text()).slice(0, 1_500_000)
      return { ok: res.ok, status: res.status, type, text }
    } catch { return null }
  }
  const prev = chain.get(host) ?? Promise.resolve()
  const p = prev.then(run, run)
  chain.set(host, p)
  return p as Promise<{ ok: boolean; status: number; type: string; text: string } | null>
}

const EVENT_LINK = /event|calendar|rapid|dislocated|layoff|job-?fair|career-?fair|hiring|workshop|networking|small-?business|entrepreneur|start-?up|score|sbdc|programs?\b/i
const strip = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()

function jsonLdEvents(html: string, pageUrl: string): Ev[] {
  const out: Ev[] = []
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: any
    try { data = JSON.parse(m[1].trim()) } catch { continue }
    const walk = (n: any) => {
      if (!n) return
      if (Array.isArray(n)) return n.forEach(walk)
      if (n['@graph']) walk(n['@graph'])
      const t = [n['@type']].flat().join(' ')
      if (/Event/.test(t) && n.name && n.startDate) {
        const loc = Array.isArray(n.location) ? n.location[0] : n.location
        const addr = loc?.address
        out.push({
          title: strip(String(n.name)), description: n.description ? strip(String(n.description)).slice(0, 1500) : undefined, startsAt: String(n.startDate), endsAt: n.endDate ? String(n.endDate) : undefined,
          format: /Online/i.test(String(n.eventAttendanceMode ?? '')) ? 'VIRTUAL' : /Mixed/i.test(String(n.eventAttendanceMode ?? '')) ? 'HYBRID' : 'IN_PERSON',
          venue: loc?.name ? strip(String(loc.name)) : undefined, city: typeof addr === 'object' ? addr?.addressLocality : undefined, state: typeof addr === 'object' ? addr?.addressRegion : undefined,
          url: typeof n.url === 'string' ? new URL(n.url, pageUrl).href : pageUrl, registerUrl: undefined,
          cost: n.isAccessibleForFree === true ? 'Free' : undefined, sourceType: 'ld+json', sourceUrl: pageUrl, hostIds: [],
        })
      }
    }
    walk(data)
  }
  return out
}

function icsEvents(text: string, pageUrl: string): Ev[] {
  const out: Ev[] = []
  const unfold = text.replace(/\r?\n[ \t]/g, '')
  for (const block of unfold.split('BEGIN:VEVENT').slice(1)) {
    const f = (k: string) => block.match(new RegExp(`^${k}[^:\\n]*:(.*)$`, 'mi'))?.[1]?.trim().replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\;/g, ';')
    const dt = (v?: string) => { const m = v?.match(/^(\d{4})(\d\d)(\d\d)(?:T(\d\d)(\d\d)(\d\d)?)?(Z)?/); return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4] ?? '09'}:${m[5] ?? '00'}:00${m[7] ? 'Z' : ''}` : undefined }
    const title = f('SUMMARY'); const start = dt(f('DTSTART'))
    if (!title || !start) continue
    out.push({ title, description: f('DESCRIPTION')?.slice(0, 1500), startsAt: start, endsAt: dt(f('DTEND')), venue: f('LOCATION'), url: f('URL') ?? pageUrl, sourceType: 'ics', sourceUrl: pageUrl, hostIds: [] })
  }
  return out
}

function rssEvents(xml: string, pageUrl: string): Ev[] {
  const out: Ev[] = []
  for (const it of xml.split(/<item[ >]/i).slice(1)) {
    const tag = (t: string) => it.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, 'i'))?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '')
    const title = tag('title'); const when = tag('ev:startdate') ?? tag('xcal:dtstart') ?? tag('startDate') ?? tag('pubDate')
    if (!title || !when || Number.isNaN(Date.parse(when))) continue
    out.push({ title: strip(title), description: tag('description') ? strip(tag('description')!).slice(0, 1500) : undefined, startsAt: new Date(when).toISOString(), url: tag('link') ? strip(tag('link')!) : pageUrl, sourceType: 'rss', sourceUrl: pageUrl, hostIds: [] })
  }
  return out
}

async function tribe(origin: string): Promise<Ev[]> {
  const r = await politeFetch(`${origin}/wp-json/tribe/events/v1/events?per_page=50&start_date=${new Date().toISOString().slice(0, 10)}`, 'application/json')
  if (!r?.ok || !r.type.includes('json')) return []
  try {
    const j = JSON.parse(r.text)
    return (j.events ?? []).map((e: any): Ev => ({
      title: strip(String(e.title ?? '')), description: e.description ? strip(String(e.description)).slice(0, 1500) : undefined, startsAt: String(e.start_date).replace(' ', 'T'), endsAt: e.end_date ? String(e.end_date).replace(' ', 'T') : undefined,
      venue: e.venue?.venue, city: e.venue?.city, state: e.venue?.stateprovince ?? e.venue?.state, url: e.url, cost: e.cost || undefined, sourceType: 'ld+json', sourceUrl: `${origin}/wp-json/tribe/events/v1/events`, hostIds: [],
    })).filter((e: Ev) => e.title && e.startsAt)
  } catch { return [] }
}

function findLinks(html: string, base: string, origin: string): { events: string[]; feeds: string[] } {
  const events = new Set<string>(); const feeds = new Set<string>()
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,160}?)<\/a>/gi)) {
    let u: URL; try { u = new URL(m[1], base) } catch { continue }
    if (/\.ics($|\?)|[?&]ical=|webcal:/i.test(u.href)) { feeds.add(u.href.replace(/^webcal:/i, 'https:')); continue }
    if (u.origin !== origin) continue
    if (/\.(pdf|jpg|png|docx?)$/i.test(u.pathname)) continue
    if (EVENT_LINK.test(u.pathname) || /event|calendar|job fair|career fair|workshop/i.test(strip(m[2]))) events.add(u.href)
  }
  for (const m of html.matchAll(/<link[^>]+type=["'](?:application\/rss\+xml|text\/calendar)["'][^>]*href=["']([^"']+)["']/gi)) { try { feeds.add(new URL(m[1], base).href) } catch {} }
  const rank = (u: string) => (/event|calendar/i.test(u) ? 0 : 1)
  return { events: [...events].sort((a, b) => rank(a) - rank(b)).slice(0, 4), feeds: [...feeds].slice(0, 3) }
}

async function crawl(s: Src): Promise<{ events: Ev[]; eventsUrl?: string; feedType: string }> {
  const origin = cleanUrl(s.website)!
  const home = await politeFetch(origin + '/')
  if (!home) return { events: [], feedType: 'error' }
  if (home.status === 403 || home.status === 429 || home.status === 503) return { events: [], feedType: 'blocked' }
  let events: Ev[] = []; let eventsUrl: string | undefined; let feedType = 'none'
  const take = (list: Ev[], url: string, type: string) => { if (list.length) { events = events.concat(list); eventsUrl ??= url; feedType = type } }
  take(jsonLdEvents(home.text, origin + '/'), origin + '/', 'ld+json')
  const links = findLinks(home.text, origin + '/', origin)
  if (!events.length && /tribe-events|the-events-calendar/i.test(home.text)) take(await tribe(origin), `${origin}/events/`, 'ld+json')
  for (const u of links.events) {
    if (events.length >= 40) break
    const r = await politeFetch(u)
    if (!r?.ok) continue
    take(jsonLdEvents(r.text, u), u, 'ld+json')
    const l2 = findLinks(r.text, u, origin)
    links.feeds.push(...l2.feeds)
    if (!events.length && /tribe-events/i.test(r.text)) take(await tribe(origin), u, 'ld+json')
  }
  // CivicPlus (most city and county sites) publishes its calendar at fixed feed URLs.
  if (!events.length && /calendar\.aspx|civicplus|civicengage|Calendar\.aspx/i.test(home.text + links.events.join(' '))) {
    links.feeds.push(`${origin}/common/modules/iCalendar/iCalendar.aspx?feed=calendar`, `${origin}/RSSFeed.aspx?ModID=58&CID=All-calendar.xml`)
  }
  if (!events.length) for (const f of [...new Set(links.feeds)].slice(0, 4)) {
    const r = await politeFetch(f, 'text/calendar,application/rss+xml,text/xml')
    if (!r?.ok) continue
    take(/BEGIN:VCALENDAR/.test(r.text) ? icsEvents(r.text, f) : rssEvents(r.text, f), f, /BEGIN:VCALENDAR/.test(r.text) ? 'ics' : 'rss')
  }
  const now = Date.now(); const horizon = now + HORIZON_DAYS * 86_400_000
  const seen = new Set<string>()
  events = events.filter((e) => { const t = Date.parse(e.startsAt); const k = `${e.title.toLowerCase()}|${e.startsAt.slice(0, 10)}`; if (seen.has(k)) return false; seen.add(k); return t >= now - 86_400_000 && t <= horizon })
  return { events, eventsUrl, feedType }
}

async function main() {
  const sources = await loadSources()
  console.log(`${sources.length} sources`)
  const outSources: any[] = []; const outEvents: Ev[] = []
  let i = 0; const CONC = 12
  const worker = async () => {
    for (;;) {
      const s = sources[i++]; if (!s) return
      const r = await crawl(s)
      for (const e of r.events) { e.hostIds = [s.id]; e.city ??= s.city ?? undefined; e.state = (e.state && /^[A-Za-z]{2}$/.test(e.state) ? e.state : s.state).toUpperCase() }
      outSources.push({ id: s.id, kind: s.kind, name: s.name, state: s.state, city: s.city, county: s.county, website: s.website, eventsUrl: r.eventsUrl, feedType: r.feedType, eventCount: r.events.length })
      outEvents.push(...r.events)
      if (i % 25 === 0) console.log(`${i}/${sources.length} sources, ${outEvents.length} events`)
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker))
  console.log({ sources: outSources.length, withEvents: outSources.filter((s) => s.eventCount).length, events: outEvents.length, blocked: outSources.filter((s) => s.feedType === 'blocked').length })
  if (OUT) writeFileSync(OUT, JSON.stringify({ sources: outSources, events: outEvents }, null, 1))
  if (POST) {
    const key = process.env.NC_ATS_API_KEY; if (!key) throw new Error('NC_ATS_API_KEY not set')
    for (let o = 0; o < Math.max(outSources.length, outEvents.length); o += 300) {
      const res = await fetch(POST, { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ sources: outSources.slice(o, o + 300), events: outEvents.slice(o, o + 300) }) })
      console.log(res.status, await res.text())
    }
  }
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
