// Sets ExclusiveJobPosting.skillIds (O*NET skills / tools the posting names, text-skill-ids.ts)
// on live jobs from their title, stored description excerpt and listed skills. New imports set
// it from the full description. Deterministic, no API call; only changed rows are written.
//
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/careers/backfill-job-skill-ids.ts [--dry-run]
import { prisma } from '../../src/lib/prisma'
import { textSkillIds } from '../../src/lib/careers/text-skill-ids'

const PAGE = 5000

async function main() {
  const dry = process.argv.includes('--dry-run')
  let lo = ''
  let seen = 0
  let changed = 0
  let withIds = 0
  let totalIds = 0
  for (;;) {
    const rows = await prisma.$queryRaw<{ id: string; title: string; description: string | null; skills: string[]; skillIds: string[] }[]>`
      SELECT "id", "title", "description", "skills", "skillIds" FROM "ExclusiveJobPosting"
      WHERE "archivedAt" IS NULL AND "id" > ${lo} ORDER BY "id" LIMIT ${PAGE}`
    if (rows.length === 0) break
    lo = rows[rows.length - 1].id
    seen += rows.length
    const ids: string[] = []
    const vals: string[] = []
    for (const r of rows) {
      const found = [...textSkillIds(r.title, r.description, r.skills.join(' , '))].sort()
      if (found.length > 0) withIds++
      totalIds += found.length
      if (found.join('|') !== [...r.skillIds].sort().join('|')) {
        ids.push(r.id)
        vals.push(`{${found.map((f) => `"${f.replace(/"/g, '')}"`).join(',')}}`)
      }
    }
    if (!dry && ids.length > 0) {
      await prisma.$executeRaw`
        UPDATE "ExclusiveJobPosting" AS j SET "skillIds" = v.sids::text[]
        FROM unnest(${ids}::text[], ${vals}::text[]) AS v(id, sids) WHERE j."id" = v.id`
    }
    changed += ids.length
  }
  console.log(`${seen} live jobs; ${withIds} name at least one O*NET skill/tool (avg ${(totalIds / Math.max(withIds, 1)).toFixed(1)}); ${changed} ${dry ? 'would change' : 'changed'}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
