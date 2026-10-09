// One-time backfill: resolves an industry bucket for every Company that
// doesn't have one, using the same cached resolver the company page uses
// (resolveCompanyIndustry -> CompanyIndustryLookup, one Claude call per
// distinct company name, cached forever), then writes it onto Company.industry.
// Safe to re-run: companies already filled are skipped, and the resolver's
// cache means a name is never paid for twice.
//
// Run: node --env-file=.env.local --conditions=react-server --import tsx scripts/backfill-company-industry.ts [--limit=N]

import { prisma } from '../src/lib/prisma'
import { resolveCompanyIndustry } from '../src/lib/market/company-industry'

const CONCURRENCY = 6

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith('--limit='))
  const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined

  const todo = await prisma.company.findMany({
    where: { industry: null },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: limit,
  })
  console.log(`${todo.length} companies without an industry`)

  let filled = 0
  let unknown = 0
  let done = 0
  const queue = [...todo]
  async function worker() {
    for (let c = queue.shift(); c; c = queue.shift()) {
      const { bucket } = await resolveCompanyIndustry(c.name)
      if (bucket) {
        await prisma.company.update({ where: { id: c.id }, data: { industry: bucket } })
        filled++
      } else {
        unknown++
      }
      if (++done % 100 === 0) console.log(`${done}/${todo.length} (filled ${filled}, unknown ${unknown})`)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  console.log(`Done. filled=${filled} unknown=${unknown}`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
