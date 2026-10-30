// Builds src/lib/ai-check/compare-pairs.json: pairs of occupations a person might be torn between, from the existing
// related-occupation similarity. One read-only query; run by hand when occupations.json changes, commit the result.
// The sitemap and generateStaticParams read the committed list, so a build never touches the database.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../../src/lib/prisma'
import occupations from '../../src/lib/ai-check/occupations.json'

const MAX_PAIRS = 300
const PER_JOB = 3 // each job's closest three neighbours
const MIN_SCORE = Number(process.env.MIN_SCORE ?? 0.8)

async function main() {
  const byOnet = new Map(occupations.map((o) => [`${o.soc}.00`, o]))
  const rows = await prisma.occupationSimilarity.findMany({
    where: { socCode: { in: [...byOnet.keys()] }, similarSocCode: { in: [...byOnet.keys()] }, score: { gte: MIN_SCORE } },
    orderBy: { score: 'desc' },
    select: { socCode: true, similarSocCode: true, score: true },
  })
  const taken = new Map<string, number>()
  const pairs = new Map<string, { a: string; b: string; score: number }>()
  for (const r of rows) {
    if (r.socCode === r.similarSocCode) continue
    const a = r.socCode.slice(0, 7)
    const b = r.similarSocCode.slice(0, 7)
    if (a.slice(0, 2) === '53' || b.slice(0, 2) === '53') continue
    if ((taken.get(a) ?? 0) >= PER_JOB) continue
    taken.set(a, (taken.get(a) ?? 0) + 1)
    const [lo, hi] = a < b ? [a, b] : [b, a]
    const key = `${lo}|${hi}`
    if (!pairs.has(key) || pairs.get(key)!.score < r.score) pairs.set(key, { a: lo, b: hi, score: r.score })
  }
  const postings = new Map(occupations.map((o) => [o.soc, o.postings]))
  const out = [...pairs.values()]
    .sort((x, y) => (postings.get(y.a) ?? 0) + (postings.get(y.b) ?? 0) - ((postings.get(x.a) ?? 0) + (postings.get(x.b) ?? 0)))
    .slice(0, MAX_PAIRS)
    .sort((x, y) => (x.a + x.b).localeCompare(y.a + y.b))
    .map((p) => [p.a, p.b])
  writeFileSync(join(process.cwd(), 'src/lib/ai-check/compare-pairs.json'), `${JSON.stringify(out)}\n`)
  console.log(`wrote ${out.length} pairs from ${pairs.size} candidates`)
}
main().finally(() => prisma.$disconnect())
