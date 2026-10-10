// Step 1: headquarters city/state for companies that have no known location.
// Haiku, from memory (no web), batched; stores a confidence and never guesses.
//   npx tsx scripts/geo/fill-company-hq.ts [--limit N]
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { ask, jsonOf, spent } from './_llm'

const CAP = 10
const prisma = new PrismaClient()
const limit = Number(process.argv.includes('--limit') ? process.argv[process.argv.indexOf('--limit') + 1] : 100000)

async function main() {
  // One pass per table (the correlated version times out on the shared DB).
  const [companies, have, withCounty, postings] = await Promise.all([
    prisma.$queryRaw<{ id: string; name: string }[]>`select id, name from "Company"`,
    prisma.$queryRaw<{ id: string }[]>`select "companyId" as id from "CompanyHq"`,
    prisma.$queryRaw<{ id: string }[]>`select distinct "companyId" as id from "WarnNotice" where "companyId" is not null and county is not null`,
    prisma.$queryRaw<{ name: string; n: number }[]>`select lower("companyName") as name, count(*)::int n from "ExclusiveJobPosting" group by 1`,
  ])
  const skip = new Set([...have, ...withCounty].map((r) => r.id))
  const count = new Map(postings.map((p) => [p.name, p.n]))
  const rows = companies
    .filter((c) => !skip.has(c.id))
    .map((c) => ({ ...c, n: count.get(c.name.toLowerCase()) ?? 0 }))
    .sort((x, y) => y.n - x.n || x.name.localeCompare(y.name))
    .slice(0, limit)
  console.log(`to resolve: ${rows.length}`)
  const BATCH = 40
  let done = 0, stored = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const prompt = `For each company below, give the city and US state of its headquarters (principal executive office).
Rules: use only what you actually know. If you are not confident, or the company is not US-headquartered, or the name is too generic to identify, return confidence "unknown" with null city and state. Never guess.
confidence: "high" = well-known company whose HQ you are sure of; "medium" = fairly sure; "unknown" = otherwise.
Reply with ONLY a JSON array, one object per company, same order: [{"i":0,"city":"Austin","state":"TX","confidence":"high"}, ...]. state is the two-letter code.

${batch.map((b, j) => `${j}. ${b.name}`).join('\n')}`
    let out: { text: string }
    try { out = await ask('hq', CAP, prompt, { maxTokens: 3000 }) } catch (e) { console.log(String(e).slice(0, 160)); break }
    const arr = jsonOf<{ i: number; city: string | null; state: string | null; confidence: string }[]>(out.text) ?? []
    for (const a of arr) {
      const b = batch[a.i]
      if (!b) continue
      const ok = a.confidence === 'high' || a.confidence === 'medium'
      const state = ok && a.state && /^[A-Z]{2}$/.test(a.state) ? a.state : null
      await prisma.$executeRaw`insert into "CompanyHq" ("companyId","city","state","confidence","source")
        values (${b.id}, ${state ? a.city : null}, ${state}, ${state ? a.confidence : 'unknown'}, 'llm-haiku-4.5') on conflict ("companyId") do nothing`
      stored++
    }
    done += batch.length
    if ((i / BATCH) % 10 === 0) console.log(`${done}/${rows.length} spent $${spent('hq').toFixed(2)}`)
  }
  const r = await prisma.$queryRaw<{ confidence: string; n: number }[]>`select confidence, count(*)::int n from "CompanyHq" group by 1`
  console.log('rows', stored, 'by confidence', JSON.stringify(r), `cost $${spent('hq').toFixed(2)}`)
}
main().finally(() => prisma.$disconnect())
