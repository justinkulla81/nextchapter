/**
 * Employee counts for companies in our directory, from Wikidata (property P1128, "employees"), with the year each figure is
 * for and the Wikidata page it came from. Free; one request.
 *
 * Only sure matches are saved. A company is matched when its normalized name equals exactly one Wikidata company's, the figure is
 * from 2021 or later, and the websites do not disagree (when both sides have one, the domains must be the same). Anything else is
 * skipped, never guessed. Dry run unless --apply.
 *
 *   npx tsx --env-file=.env.local scripts/companies/import-wikidata-headcount.ts [--apply]
 */
import { PrismaClient } from '@prisma/client'
import { normalizeOrgName } from '../../src/lib/text/org-name-match'

const prisma = new PrismaClient()
const MIN_YEAR = 2021

const QUERY = `
SELECT ?item ?itemLabel ?emp ?year ?site WHERE {
  ?item p:P1128 ?st . ?st ps:P1128 ?emp .
  OPTIONAL { ?st pq:P585 ?year }
  ?item wdt:P17 wd:Q30 .
  OPTIONAL { ?item wdt:P856 ?site }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 30000`

interface Fact { qid: string; name: string; employees: number; year: number; site: string | null }

const host = (u: string | null | undefined): string | null => {
  if (!u) return null
  try { return new URL(/^https?:/.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, '').toLowerCase() } catch { return null }
}
const root = (h: string | null) => (h ? h.split('.').slice(-2).join('.') : null)

async function wikidata(): Promise<Map<string, Fact[]>> {
  const res = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(QUERY)}`, {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'NextChapterDataBot/1.0 (justin@launchyournextchapter.com)' },
    signal: AbortSignal.timeout(110_000),
  })
  if (!res.ok) throw new Error(`Wikidata ${res.status}`)
  const rows = ((await res.json()) as { results: { bindings: Record<string, { value: string }>[] } }).results.bindings
  // The latest dated figure for each item.
  const latest = new Map<string, Fact>()
  for (const r of rows) {
    const employees = Number(r.emp.value)
    const year = Number(r.year?.value?.slice(0, 4))
    if (!Number.isFinite(employees) || employees <= 0 || !Number.isFinite(year)) continue
    const qid = r.item.value.split('/').pop()!
    const f: Fact = { qid, name: r.itemLabel.value, employees, year, site: r.site?.value ?? null }
    const cur = latest.get(qid)
    if (!cur || f.year > cur.year) latest.set(qid, f)
  }
  const byName = new Map<string, Fact[]>()
  for (const f of latest.values()) {
    const k = normalizeOrgName(f.name)
    if (k) byName.set(k, [...(byName.get(k) ?? []), f])
  }
  return byName
}

async function main() {
  const apply = process.argv.includes('--apply')
  const facts = await wikidata()
  const companies = await prisma.$queryRaw<{ id: string; name: string; cn: string; website: string | null }[]>`
    SELECT id, name, "canonicalNameNormalized" AS cn, website FROM "Company"`
  let matched = 0, tooOld = 0, ambiguous = 0, siteMismatch = 0
  const saves: { id: string; f: Fact }[] = []
  for (const c of companies) {
    const m = facts.get(c.cn)
    if (!m) continue
    if (m.length > 1) { ambiguous++; continue }
    const f = m[0]
    if (f.year < MIN_YEAR) { tooOld++; continue }
    const a = root(host(c.website)), b = root(host(f.site))
    if (a && b && a !== b) { siteMismatch++; continue }
    matched++
    saves.push({ id: c.id, f })
  }
  console.log(`${facts.size} Wikidata names; ${companies.length} companies. saved ${matched}; skipped: ${ambiguous} ambiguous, ${tooOld} older than ${MIN_YEAR}, ${siteMismatch} website mismatch${apply ? '' : ' (dry run)'}`)
  console.log(saves.slice(0, 15).map(({ id, f }) => `${f.name}: ${f.employees.toLocaleString()} (${f.year}) ${id}`).join('\n'))
  if (!apply) return
  for (const { id, f } of saves) {
    await prisma.$executeRaw`
      INSERT INTO "CompanyHeadcount" ("companyId", employees, "asOfYear", source, "sourceUrl", "matchedName", "checkedAt")
      VALUES (${id}, ${f.employees}, ${f.year}, 'wikidata', ${`https://www.wikidata.org/wiki/${f.qid}`}, ${f.name}, now())
      ON CONFLICT ("companyId") DO UPDATE SET employees = EXCLUDED.employees, "asOfYear" = EXCLUDED."asOfYear",
        "sourceUrl" = EXCLUDED."sourceUrl", "matchedName" = EXCLUDED."matchedName", "checkedAt" = now()`
  }
  console.log(`saved ${saves.length}`)
}
main().finally(() => prisma.$disconnect())
