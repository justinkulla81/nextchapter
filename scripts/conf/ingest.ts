// Bulk ingest of researched conferences: node_modules/.bin/tsx scripts/conf/ingest.ts <file.jsonl> <wave-label> [--apply]
// Dedupes with the Quick Add code, fetches each official URL politely (one request at a time, 2.5s apart per host, robots.txt honoured),
// and never keeps a fact the page does not back up: dates are dropped unless the page shows the year. Rows publish only when the URL loads.
import fs from 'node:fs'
import { PrismaClient } from '@prisma/client'
import * as cheerio from 'cheerio'
import { canonicalUrlKey, isPublicHttpUrl, isDeepLinkOnly, nameKey, seriesSlug } from '../../src/lib/conferences/canonical'
import { findExistingSeries } from '../../src/lib/conferences/dedupe'
import { INDUSTRY_BUCKET_NAMES } from '../../src/lib/constants/industry-buckets'
import { PRIMARY_FUNCTION_OPTIONS } from '../../src/lib/constants/onboarding'

const prisma = new PrismaClient()
const [file, wave, flag] = process.argv.slice(2)
const APPLY = flag === '--apply'
const UA = 'Mozilla/5.0 (compatible; NextChapterEventCheck/1.0; +https://launchyournextchapter.com)'
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const STATES = new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR'.split(' '))
const KINDS = ['CONFERENCE', 'TRADE_SHOW', 'SUMMIT', 'WORKSHOP']
const ACCESS = ['PAID', 'FREE', 'INVITE', 'APPLY', 'MIXED']
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const lastHit = new Map<string, number>()
const robots = new Map<string, string[]>()
async function polite(host: string) {
  const wait = (lastHit.get(host) ?? 0) + 2500 - Date.now()
  if (wait > 0) await sleep(wait)
  lastHit.set(host, Date.now())
}
async function robotsAllows(u: URL): Promise<boolean> {
  if (!robots.has(u.host)) {
    let dis: string[] = []
    try {
      await polite(u.host)
      const r = await fetch(`${u.protocol}//${u.host}/robots.txt`, { signal: AbortSignal.timeout(8000), headers: { 'user-agent': UA } })
      if (r.ok) {
        let star = false
        for (const line of (await r.text()).split('\n')) {
          const l = line.split('#')[0].trim()
          if (/^user-agent:/i.test(l)) star = l.split(':')[1].trim() === '*'
          else if (star && /^disallow:/i.test(l)) dis.push(l.slice(9).trim())
        }
      }
    } catch { dis = [] }
    robots.set(u.host, dis)
  }
  return !robots.get(u.host)!.some((d) => d && (u.pathname || '/').startsWith(d))
}

type Fetched = { status: 'OK' | 'BLOCKED' | 'BROKEN' | 'ERROR' | 'ROBOTS'; text: string; finalUrl: string }
async function load(url: string): Promise<Fetched> {
  const u = new URL(url)
  if (!(await robotsAllows(u))) return { status: 'ROBOTS', text: '', finalUrl: url }
  await polite(u.host)
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': UA, accept: 'text/html,*/*' }, redirect: 'follow' })
    if (res.status === 403 || res.status === 429 || res.status === 503) return { status: 'BLOCKED', text: '', finalUrl: res.url }
    if (!res.ok) return { status: res.status === 404 || res.status === 410 ? 'BROKEN' : 'ERROR', text: '', finalUrl: res.url }
    const html = (await res.text()).slice(0, 600_000)
    const $ = cheerio.load(html)
    $('script,style,noscript').remove()
    return { status: 'OK', text: $('title').text() + ' ' + $('body').text().replace(/\s+/g, ' ').slice(0, 80_000), finalUrl: res.url }
  } catch { return { status: 'ERROR', text: '', finalUrl: url } }
}

const s = (v: unknown, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null)
const only = (v: unknown, allowed: readonly string[]) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && allowed.includes(x)))] : [])

async function main() {
  const rows = fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim().startsWith('{')).map((l) => JSON.parse(l))
  const existing = await prisma.conferenceEvent.findMany({ select: { id: true, name: true, urlKey: true } })
  const ids = new Set(existing.map((e) => e.id))
  const pool = [...existing]
  const added: any[] = []
  const rejected: { name: string; why: string }[] = []
  const seenInFile = new Set<string>()

  for (const r of rows) {
    const name = s(r.name, 160); const url = s(r.url, 500)
    const reject = (why: string) => rejected.push({ name: name ?? '(no name)', why })
    if (!name || !url) { reject('missing name or url'); continue }
    if (!isPublicHttpUrl(url) || isDeepLinkOnly(url)) { reject('not an official public URL'); continue }
    const urlKey = canonicalUrlKey(url)
    if (!urlKey) { reject('bad url'); continue }
    if (seenInFile.has(urlKey)) { reject('duplicate in file'); continue }
    seenInFile.add(urlKey)
    const hit = findExistingSeries(pool, { urlKey, name })
    if (hit) { reject(`already in catalog (${hit.by}: ${hit.id})`); continue }
    const state = s(r.state, 2)?.toUpperCase() ?? null
    if (state && !STATES.has(state)) { reject(`bad state ${state}`); continue }
    const industries = only(r.industries, INDUSTRY_BUCKET_NAMES)
    if (!industries.length && r.industries?.length) { reject('no valid industry'); continue }

    const page = await load(url)
    if (page.status === 'ROBOTS') { reject('robots.txt disallows'); continue }
    if (page.status === 'BROKEN') { reject('URL 404'); continue }
    const text = page.text
    let start = day(r.startDate); let end = day(r.endDate)
    // Dates survive only when the page shows the year (and, when we could read it, the month name).
    if (start && page.status === 'OK') {
      const [y, m] = start.split('-')
      if (!text.includes(y) || !new RegExp(MONTHS[Number(m) - 1].slice(0, 3), 'i').test(text)) { start = null; end = null }
    }
    if (start && end && end < start) end = start
    if (start && Date.parse(start) < Date.now() - 86_400_000) { start = null; end = null } // past editions are not "upcoming dates"
    const tokens = nameKey(name).split(' ').filter((t) => t.length > 2)
    const verified = page.status === 'OK' && tokens.length > 0 && tokens.filter((t) => text.toLowerCase().includes(t)).length >= Math.ceil(tokens.length * 0.6)
    if (page.status === 'OK' && !verified) { reject('page does not mention the event name'); continue }

    let id = seriesSlug(name) || 'conference'
    if (ids.has(id)) id = `${id}-${Math.random().toString(36).slice(2, 6)}`
    ids.add(id)
    const typicalMonth = MONTHS.includes(r.typicalMonth) ? r.typicalMonth : start ? MONTHS[Number(start.split('-')[1]) - 1] : null
    const kind = KINDS.includes(r.kind) ? r.kind : 'CONFERENCE'
    const importance = [1, 2, 3].includes(r.importance) ? r.importance : 3
    const row = {
      id, name, organizer: s(r.organizer, 160), url, urlKey, kind,
      format: ['IN_PERSON', 'VIRTUAL', 'HYBRID'].includes(r.format) ? r.format : 'IN_PERSON',
      startDate: start ? new Date(`${start}T00:00:00Z`) : null, endDate: start ? new Date(`${(end ?? start)}T00:00:00Z`) : null,
      datesConfirmed: !!start, typicalMonth, city: s(r.city, 80), state, country: 'US',
      industries, functions: only(r.functions, PRIMARY_FUNCTION_OPTIONS), importance,
      whyAttend: s(r.whyAttend, 300), seniorities: only(r.seniorities, ['EARLY', 'MID', 'SENIOR', 'EXECUTIVE']), cheaperWays: s(r.cheaperWays, 300), access: ACCESS.includes(r.access) ? r.access : 'PAID',
      costLow: Number.isInteger(r.costLow) ? r.costLow : null, costHigh: Number.isInteger(r.costHigh) ? r.costHigh : null, costNote: s(r.costNote, 200),
      published: page.status === 'OK', verified, checkedAt: new Date(), linkStatus: page.status, linkCheckedAt: new Date(),
      source: `${wave}: ${s(r.source, 80) ?? 'official site'}`,
    }
    pool.push({ id, name, urlKey })
    added.push(row)
    if (APPLY) {
      await prisma.conferenceEvent.create({ data: row })
      await prisma.conferenceEdition.upsert({
        where: { seriesId_year: { seriesId: id, year: start ? Number(start.slice(0, 4)) : new Date().getUTCFullYear() } },
        create: { seriesId: id, year: start ? Number(start.slice(0, 4)) : new Date().getUTCFullYear(), status: start ? 'CONFIRMED' : 'TBA', startDate: row.startDate, endDate: row.endDate, city: row.city, state, country: 'US', url },
        update: {},
      })
    }
    process.stdout.write(`${APPLY ? '+' : '?'} ${name} [${page.status}${verified ? ',verified' : ''}${start ? ',dated' : ''}]\n`)
  }
  const by = (k: (a: any) => string[]) => added.reduce((m: Record<string, number>, a) => { for (const x of k(a)) m[x] = (m[x] ?? 0) + 1; return m }, {})
  const summary = {
    input: rows.length, added: added.length, published: added.filter((a) => a.published).length, dated: added.filter((a) => a.datesConfirmed).length,
    byIndustry: by((a) => a.industries), byState: by((a) => [a.state ?? '(none)']), byLink: by((a) => [a.linkStatus]),
    rejected: rejected.length, rejectedWhy: rejected.reduce((m: Record<string, number>, x) => { const k = x.why.replace(/\(.*\)/, ''); m[k] = (m[k] ?? 0) + 1; return m }, {}),
  }
  fs.writeFileSync(file.replace(/\.jsonl$/, '') + (APPLY ? '.applied.json' : '.dry.json'), JSON.stringify({ summary, added: added.map((a) => a.id), rejected }, null, 1))
  console.log(JSON.stringify(summary, null, 1))
}
main().finally(() => prisma.$disconnect())
