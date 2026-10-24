// Announced layoffs that coverage ties to AI, by month and by the announcing
// company's home country.
//
// Source: LayoffNewsMention, grouped by the WarnNotice each mention was matched
// to (so ten articles about one announcement, and name variants like
// "Barclays bank" and "UK's biggest bank Barclays", count once). Mentions that
// matched no notice are ignored rather than guessed at.
//
// A notice counts as AI-cited when at least one of its headlines mentions AI,
// automation or machine learning and none of those headlines is a denial
// ("insists AI is not behind", "denies direct AI replacement"). This is what
// the coverage says the company claimed; it does not verify the cause.
//
// Employer names on news-created notices are parsed from headlines and are
// sometimes not companies at all ("AI blamed for", "Corporate Jobs"). Only
// employers that resolve to a country are counted; the rest are reported as
// excluded. Name variants are merged through the canonical column of
// data/employer-countries.csv (Amex, American Express).
//
// Country is the company's headquarters country, not where the jobs are lost:
// a global cut is counted at the home country. Looked up once from Wikidata
// and kept in data/employer-countries.csv, which can be edited by hand (a row
// with source "manual" is never overwritten). Unresolved employers show as
// "Unknown" rather than being assigned a country.
//
// Usage: npm run report:ai-layoffs [-- --edition 2026-10]
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '@/lib/prisma'

// The news check started collecting in October 2026; earlier months hold only
// the odd stray article, so a count for them would read as a calm market that
// never existed. The series starts at the first month with real coverage.
const FIRST_FULL_MONTH = '2026-10'

const AI = /\bAI\b|artificial intelligence|automation|automat(e|ing)\b|machine learning/i
const DENIED = /\b(denies|denied|insists?|not (an? |the )?(ai|behind|due|because|driven|about)|no (direct )?ai|isn.t (about |due to )?ai|rather than|not an ai)\b/i
const BUSINESS = /company|bank|corporation|manufacturer|retailer|firm|conglomerate|services|software|technology|multinational|airline|insurance|chain|brand|group|publisher|newspaper|supermarket|studio|carrier|provider|maker|producer|operator/i

const CSV_FILE = path.join(process.cwd(), 'data', 'employer-countries.csv')
const US_STATES = new Set('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC PR'.split(' '))

type CountryRow = { country: string; source: string; canonical: string }

function readCountries(): Map<string, CountryRow> {
  const m = new Map<string, CountryRow>()
  if (!fs.existsSync(CSV_FILE)) return m
  for (const line of fs.readFileSync(CSV_FILE, 'utf8').split('\n').slice(1)) {
    const [employer, country, source, canonical] = line.split(',').map((s) => s.trim())
    if (employer) m.set(employer.toLowerCase(), { country, source, canonical: canonical || '' })
  }
  return m
}

function writeCountries(m: Map<string, CountryRow>) {
  const lines = ['employer,country_iso3,source,canonical', ...[...m].sort().map(([e, r]) => `${e},${r.country},${r.source},${r.canonical}`)]
  fs.writeFileSync(CSV_FILE, lines.join('\n') + '\n')
}

type Claims = Record<string, { mainsnak?: { datavalue?: { value?: { id?: string } | string } } }[]>
type Wd = { search?: { id: string; label?: string; description?: string }[]; entities?: Record<string, { claims?: Claims }> }

async function wikidata(params: Record<string, string>) {
  const url = 'https://www.wikidata.org/w/api.php?' + new URLSearchParams({ format: 'json', ...params })
  const r = await fetch(url, { headers: { 'User-Agent': 'NextChapter Research (justin@launchyournextchapter.com)' } })
  if (!r.ok) throw new Error(`Wikidata ${r.status}`)
  return r.json() as Promise<Wd>
}

/** ISO3 of the company's country via Wikidata: country (P17) or headquarters (P159) country. Null if unsure. */
async function lookupCountry(name: string): Promise<string | null> {
  const s = await wikidata({ action: 'wbsearchentities', search: name, language: 'en', limit: '5' })
  const hit = (s.search ?? []).find((h) => BUSINESS.test(h.description ?? '') && (h.label ?? '').toLowerCase() === name.toLowerCase())
  if (!hit) return null
  const e = await wikidata({ action: 'wbgetentities', ids: hit.id, props: 'claims', })
  const claims = e.entities?.[hit.id]?.claims ?? {}
  const countryId = async (qid: string) => {
    const c = await wikidata({ action: 'wbgetentities', ids: qid, props: 'claims' })
    const v = c.entities?.[qid]?.claims?.P298?.[0]?.mainsnak?.datavalue?.value
    return typeof v === 'string' ? v : undefined // ISO 3166-1 alpha-3
  }
  const idOf = (c?: Claims[string]) => { const v = c?.[0]?.mainsnak?.datavalue?.value; return typeof v === 'object' ? v?.id : undefined }
  const direct = idOf(claims.P17)
  if (direct) return (await countryId(direct)) ?? null
  const hq = idOf(claims.P159)
  if (hq) {
    const h = await wikidata({ action: 'wbgetentities', ids: hq, props: 'claims' })
    const c = idOf(h.entities?.[hq]?.claims?.P17)
    if (c) return (await countryId(c)) ?? null
  }
  return null
}

async function main() {
  const edition = process.argv.includes('--edition') ? process.argv[process.argv.indexOf('--edition') + 1] : null
  const mentions = await prisma.layoffNewsMention.findMany({
    where: { publishedAt: { gte: new Date(`${FIRST_FULL_MONTH}-01`) }, noticeId: { not: null } },
    select: { noticeId: true, headline: true, url: true },
  })
  const byNotice = new Map<string, { cited: string | null; denied: boolean; mentions: number }>()
  for (const r of mentions) {
    const c = byNotice.get(r.noticeId!) ?? { cited: null, denied: false, mentions: 0 }
    c.mentions++
    if (AI.test(r.headline)) {
      if (DENIED.test(r.headline)) c.denied = true
      else c.cited ??= r.url
    }
    byNotice.set(r.noticeId!, c)
  }
  const notices = await prisma.warnNotice.findMany({
    where: { id: { in: [...byNotice.keys()] } },
    select: { id: true, employer: true, state: true, employees: true, noticeDate: true, source: true },
  })

  const countries = readCountries()
  // One row per canonical company and month: a cited claim beats a denial, the larger headcount wins.
  const events = new Map<string, { month: string; employer: string; country: string; jobs: number; claim: 'cited' | 'denied'; url: string }>()
  let excluded = 0
  for (const n of notices) {
    if (!n.noticeDate) continue
    const month = n.noticeDate.toISOString().slice(0, 7)
    if (month < FIRST_FULL_MONTH || month > new Date().toISOString().slice(0, 7)) continue
    const m = byNotice.get(n.id)!
    const claim = m.cited ? 'cited' : m.denied ? 'denied' : null
    if (!claim) continue
    let country = n.state && US_STATES.has(n.state) ? 'USA' : null
    let canonical = n.employer
    const known = countries.get(n.employer.toLowerCase())
    if (known) { canonical = known.canonical || n.employer; if (!country) country = known.country }
    else if (!country) {
      country = await lookupCountry(n.employer).catch(() => null)
      countries.set(n.employer.toLowerCase(), { country: country ?? 'UNK', source: 'wikidata', canonical: '' })
    }
    if (!country || country === 'UNK') { excluded++; continue }
    const key = `${month}|${canonical.toLowerCase()}`
    const prev = events.get(key)
    const jobs = n.employees ?? 0
    if (!prev) events.set(key, { month, employer: canonical, country, jobs, claim, url: m.cited ?? '' })
    else {
      prev.jobs = Math.max(prev.jobs, jobs)
      if (claim === 'cited' && prev.claim === 'denied') { prev.claim = 'cited'; prev.url = m.cited ?? '' }
    }
  }
  writeCountries(countries)

  const agg = new Map<string, { cited: number; denied: number; jobs: number }>()
  for (const e of events.values()) {
    const k = `${e.month},${e.country}`
    const a = agg.get(k) ?? { cited: 0, denied: 0, jobs: 0 }
    if (e.claim === 'cited') { a.cited++; a.jobs += e.jobs } else a.denied++
    agg.set(k, a)
  }
  const lines = ['month,country_iso3,companies_ai_cited,companies_ai_denied,jobs_ai_cited']
  for (const [k, a] of [...agg].sort()) lines.push(`${k},${a.cited},${a.denied},${a.jobs}`)
  const ev = ['month,employer,country_iso3,jobs,ai_claim,source_url',
    ...[...events.values()].sort((a, b) => b.jobs - a.jobs)
      .map((e) => [e.month, `"${e.employer.replace(/"/g, '')}"`, e.country, e.jobs, e.claim, e.url].join(','))]

  const dirs = [path.join(process.cwd(), 'public', 'reports')]
  if (edition) dirs.push(path.join(dirs[0], 'early-warning', edition))
  for (const d of dirs) {
    fs.mkdirSync(d, { recursive: true })
    fs.writeFileSync(path.join(d, 'ai-layoffs-monthly.csv'), lines.join('\n') + '\n')
    fs.writeFileSync(path.join(d, 'ai-layoffs-events.csv'), ev.join('\n') + '\n')
  }
  console.log(lines.join('\n'))
  console.log(`\n${events.size} companies with an AI claim; ${excluded} AI-claim notices excluded (no company/country resolved); ${notices.length} notices matched, ${mentions.length} mentions used`)
  await prisma.$disconnect()
}
main()
