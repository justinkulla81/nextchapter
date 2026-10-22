// Sets ExclusiveJobPosting.aeiSocCode / aeiSocSource / aiExposureLevel (src/lib/aei/job-exposure.ts) on
// every job, live and archived: the crawler's O*NET match when it has one, else the fixed function x
// level proxy. Deterministic, no API call. Keyset pages of 5,000; each page's update is its own small
// statement with a short timeout. Re-runnable: only rows whose values change are written.
//
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/careers/aei/backfill-job-aei.ts [--dry-run] [--live-only]
import { prisma } from '../../../src/lib/prisma'
import { aeiSocFor, lookupOccupation } from '../../../src/lib/aei/job-exposure'
import { inferFunctionFromTitle } from '../../../src/lib/jobs/infer-job-function'

const PAGE = 5000

async function main() {
  const dry = process.argv.includes('--dry-run')
  const liveOnly = process.argv.includes('--live-only')
  const occ = new Map((await prisma.aeiOccupation.findMany({ select: { socCode: true, exposureLevel: true } })).map((o) => [o.socCode, o.exposureLevel]))
  if (occ.size === 0) throw new Error('AeiOccupation is empty: run load-aei.ts first')
  let lo = ''
  let seen = 0
  let changed = 0
  const bySource: Record<string, number> = {}
  const byLevel: Record<string, number> = {}
  const t0 = Date.now()
  for (;;) {
    const rows = await prisma.$queryRaw<
      { id: string; title: string; targetFunction: string | null; socCode: string | null; level: string | null; aeiSocCode: string | null; aeiSocSource: string | null; aiExposureLevel: string | null }[]
    >`SELECT "id", "title", "targetFunction", "socCode", "level", "aeiSocCode", "aeiSocSource", "aiExposureLevel" FROM "ExclusiveJobPosting"
      WHERE "id" > ${lo} AND (${!liveOnly} OR "archivedAt" IS NULL) ORDER BY "id" LIMIT ${PAGE}`
    if (rows.length === 0) break
    lo = rows[rows.length - 1].id
    seen += rows.length
    const ids: string[] = []
    const socs: string[] = []
    const sources: string[] = []
    const levels: (string | null)[] = []
    for (const r of rows) {
      const { soc, source } = aeiSocFor({ socCode: r.socCode, title: r.title, fn: r.targetFunction ?? inferFunctionFromTitle(r.title), level: r.level })
      const lvl = lookupOccupation(occ, soc)
      bySource[source] = (bySource[source] ?? 0) + 1
      byLevel[lvl ?? 'none'] = (byLevel[lvl ?? 'none'] ?? 0) + 1
      if (soc !== r.aeiSocCode || source !== r.aeiSocSource || lvl !== r.aiExposureLevel) {
        ids.push(r.id)
        socs.push(soc)
        sources.push(source)
        levels.push(lvl)
      }
    }
    if (!dry && ids.length > 0) {
      await prisma.$transaction([
        prisma.$executeRaw`SET LOCAL statement_timeout = '60s'`,
        prisma.$executeRaw`
          UPDATE "ExclusiveJobPosting" AS j SET "aeiSocCode" = v.soc, "aeiSocSource" = v.src, "aiExposureLevel" = v.lvl
          FROM unnest(${ids}::text[], ${socs}::text[], ${sources}::text[], ${levels}::text[]) AS v(id, soc, src, lvl) WHERE j."id" = v.id`,
      ])
    }
    changed += ids.length
    if ((seen / PAGE) % 20 === 0) console.log(`${seen} seen, ${changed} ${dry ? 'would change' : 'changed'} (${Math.round((Date.now() - t0) / 1000)}s)`)
  }
  console.log(`${seen} jobs, ${changed} ${dry ? 'would change' : 'changed'}`)
  console.log('source', bySource)
  console.log('level', byLevel)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
