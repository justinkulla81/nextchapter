/**
 * Summarises data/geo/crawl/*.json into the BuyerCrawl table (and a spreadsheet-ready JSON).
 *   npx tsx --env-file=.env.local scripts/geo/load-buyer-crawl.ts            dry run, prints totals
 *   npx tsx --env-file=.env.local scripts/geo/load-buyer-crawl.ts --commit
 */
import { PrismaClient, Prisma } from '@prisma/client'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const prisma = new PrismaClient()
const COMMIT = process.argv.includes('--commit')
const DIR = 'data/geo/crawl'
const YEAR_AGO = Date.now() - 365 * 86_400_000
const GENERIC = /^(info|contact|admin|webmaster|office|hello|support|noreply|no-reply)@/i

interface Page { url: string; title: string; role?: string; emails: string[]; phones: string[]; solicitations: Sol[]; people: Person[]; policy: string[]; topics: Record<string, boolean>; systems: string[]; vendor_hits?: string[]; meeting_links?: { label: string; url: string }[]; rr_snippet: string }
interface Sol { label: string; url: string; dates: string[]; context: string; pdf: boolean }
interface Person { name: string; title: string; email: string | null; phone: string | null }

function parseDate(s: string): number | null {
  const t = Date.parse(s.replace(/(\d{1,2})\/(\d{1,2})\/(\d{2})$/, '$1/$2/20$3'))
  return Number.isNaN(t) ? null : t
}

async function main() {
  const rows: Prisma.BuyerCrawlCreateManyInput[] = []
  for (const f of readdirSync(DIR).filter((x) => x.endsWith('.json'))) {
    const r = JSON.parse(readFileSync(join(DIR, f), 'utf8')) as { target: { kind: string; id: string; name: string; state: string; website: string }; crawledAt?: string; status?: number; error?: string; pages: Page[] }
    const pages = r.pages ?? []
    const seen = new Set<string>()
    const sols: (Sol & { when: number | null })[] = []
    for (const p of pages) for (const s of p.solicitations ?? []) {
      if (seen.has(s.url)) continue
      seen.add(s.url)
      const ts = s.dates.map(parseDate).filter((x): x is number => x !== null)
      sols.push({ ...s, when: ts.length ? Math.max(...ts) : null })
    }
    const people = new Map<string, Person>()
    for (const p of pages) for (const x of p.people ?? []) people.set(x.name.toLowerCase(), people.get(x.name.toLowerCase()) ?? x)
    const emails = [...new Set(pages.flatMap((p) => p.emails ?? []))].sort((a, b) => Number(GENERIC.test(a)) - Number(GENERIC.test(b))).slice(0, 15)
    const proc = pages.find((p) => p.role === 'procurement' && (p.solicitations ?? []).length > 0) ?? pages.find((p) => p.role === 'procurement')
    const topics = Object.entries(pages.reduce<Record<string, boolean>>((acc, p) => { for (const [k, v] of Object.entries(p.topics ?? {})) acc[k] = acc[k] || v; return acc }, {})).filter(([, v]) => v).map(([k]) => k)
    rows.push({
      id: `${r.target.kind}-${r.target.id}`, kind: r.target.kind, targetId: r.target.id, name: r.target.name, state: r.target.state, website: r.target.website,
      crawledAt: new Date(r.crawledAt ?? Date.now()), httpStatus: r.status ?? null, error: r.error ?? null, pagesCrawled: pages.length,
      procurementUrl: proc?.url ?? null, solicitations: sols.slice(0, 30) as unknown as Prisma.InputJsonValue, solicitationCount: sols.length,
      recentCount: sols.filter((s) => s.when === null || s.when >= YEAR_AGO).length,
      people: [...people.values()].slice(0, 15) as unknown as Prisma.InputJsonValue, emails,
      phones: [...new Set(pages.flatMap((p) => p.phones ?? []))].slice(0, 8),
      systems: [...new Set(pages.flatMap((p) => [...(p.systems ?? []), ...(p.vendor_hits ?? [])]))], topics,
      policy: [...new Set(pages.flatMap((p) => p.policy ?? []))].slice(0, 4) as unknown as Prisma.InputJsonValue,
      rapidResponseNote: pages.map((p) => p.rr_snippet).find(Boolean) ?? null,
    })
  }
  const by = (k: string) => rows.filter((r) => r.kind === k).length
  console.log(`sites ${rows.length} (BOARD ${by('BOARD')}, EDD ${by('EDD')}, EDO ${by('EDO')}, STATE ${by('STATE')})`)
  console.log(`  read ok ${rows.filter((r) => !r.error).length}, failed ${rows.filter((r) => r.error).length}`)
  console.log(`  with solicitations ${rows.filter((r) => (r.solicitationCount ?? 0) > 0).length}, with a recent or undated one ${rows.filter((r) => (r.recentCount ?? 0) > 0).length}`)
  console.log(`  name a system/vendor ${rows.filter((r) => (r.systems as string[]).length > 0).length}, mention rapid response ${rows.filter((r) => (r.topics as string[]).includes('rapid_response')).length}, AI ${rows.filter((r) => (r.topics as string[]).includes('ai')).length}`)
  writeFileSync('data/geo/buyer-crawl-summary.json', JSON.stringify(rows))
  if (!COMMIT) return console.log('\nDry run only. Re-run with --commit to write.')
  for (let i = 0; i < rows.length; i += 100) {
    const part = rows.slice(i, i + 100)
    await prisma.buyerCrawl.deleteMany({ where: { id: { in: part.map((p) => p.id) } } })
    await prisma.buyerCrawl.createMany({ data: part })
  }
  console.log('written', rows.length)
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
