// Sets ExclusiveJobPosting.subFunction (src/lib/jobs/sub-functions.ts) on live jobs:
// allowlisted title patterns / O*NET codes within each job's function (the function the
// import sent, else the board's reading of the title). Deterministic, no API call.
// Re-runnable: only rows whose value changes are written, a page at a time.
//
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/careers/backfill-sub-functions.ts [--dry-run]
import { prisma } from '../../src/lib/prisma'
import { subFunctionFor } from '../../src/lib/jobs/sub-functions'
import { inferFunctionFromTitle } from '../../src/lib/jobs/infer-job-function'

const PAGE = 5000

async function main() {
  const dry = process.argv.includes('--dry-run')
  let lo = ''
  let seen = 0
  let set = 0
  const counts: Record<string, number> = {}
  for (;;) {
    const rows = await prisma.$queryRaw<{ id: string; title: string; targetFunction: string | null; socCode: string | null; subFunction: string | null }[]>`
      SELECT "id", "title", "targetFunction", "socCode", "subFunction" FROM "ExclusiveJobPosting"
      WHERE "archivedAt" IS NULL AND "id" > ${lo} ORDER BY "id" LIMIT ${PAGE}`
    if (rows.length === 0) break
    lo = rows[rows.length - 1].id
    seen += rows.length
    const ids: string[] = []
    const subs: (string | null)[] = []
    for (const r of rows) {
      const sub = subFunctionFor({ title: r.title, fn: r.targetFunction ?? inferFunctionFromTitle(r.title), soc: r.socCode })
      if (sub) counts[sub] = (counts[sub] ?? 0) + 1
      if (sub !== r.subFunction) {
        ids.push(r.id)
        subs.push(sub)
      }
    }
    if (!dry && ids.length > 0) {
      await prisma.$executeRaw`
        UPDATE "ExclusiveJobPosting" AS j SET "subFunction" = v.sub
        FROM unnest(${ids}::text[], ${subs}::text[]) AS v(id, sub) WHERE j."id" = v.id`
    }
    set += ids.length
  }
  console.log(`${seen} live jobs, ${set} ${dry ? 'would change' : 'changed'}`)
  console.log(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join('\n'))
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
