// Sets the AI-skills columns (aiSkillGroups / aiSkillItems / aiToolsNamed / aiCertsNamed) on live
// board jobs from the crawler's own read of the FULL posting text — the board stores only an
// excerpt. Input: a JSONL export from the crawler (one line per crawler row: url, source job id,
// full-text length, and ncrawl/ai_skills.py's result), made by a read-only pass over jobs.db
// (+ the Workday detail cache for rows stored without a description). Matches by url, then by
// the source's job id when that id is unique in the crawler. Batched UPDATEs of 5,000 rows;
// only changed rows are written. New imports set the columns themselves (import-jobs.py).
//
//   node --env-file=.env.local --import tsx scripts/careers/backfill-ai-skills.ts <ai_skills.jsonl> [--dry-run]
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { prisma } from '../../src/lib/prisma'
import { importAiSkillFields, AI_SKILL_ITEMS } from '../../src/lib/skills/ai-skills'

const PAGE = 5000
const FULL_TEXT = 1000

type Hit = { items: string[]; groups: string[]; tools: string[]; certs: string[]; n: number }

async function load(path: string) {
  const byUrl = new Map<string, Hit>()
  const byExt = new Map<string, Hit | null>() // null = id not unique
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity })
  for await (const line of rl) {
    if (!line) continue
    const j = JSON.parse(line) as { u: string; x: string | null; n: number; r: { groups: string[]; items: string[]; tools: string[]; certs: string[] } }
    const f = importAiSkillFields({ aiSkillItems: j.r.items, aiToolsNamed: j.r.tools, aiCertsNamed: j.r.certs })
    const hit: Hit = { items: f.aiSkillItems!, groups: f.aiSkillGroups!, tools: f.aiToolsNamed!, certs: f.aiCertsNamed!, n: j.n }
    const prev = byUrl.get(j.u)
    if (!prev || hit.n > prev.n) byUrl.set(j.u, hit)
    if (j.x) byExt.set(j.x, byExt.has(j.x) ? null : hit)
  }
  return { byUrl, byExt }
}

const arr = (xs: string[]) => `{${xs.map((x) => `"${x.replace(/["\\]/g, '')}"`).join(',')}}`

async function main() {
  const path = process.argv[2]
  if (!path) throw new Error('usage: backfill-ai-skills.ts <ai_skills.jsonl> [--dry-run]')
  const dry = process.argv.includes('--dry-run')
  const { byUrl, byExt } = await load(path)
  console.log(`crawler rows: ${byUrl.size} urls`)
  let lo = ''
  const stat = { live: 0, matchedUrl: 0, matchedExt: 0, fullText: 0, anyAi: 0, changed: 0 }
  const groups: Record<string, number> = { builder: 0, applied: 0, leadership: 0 }
  const items: Record<string, number> = Object.fromEntries(AI_SKILL_ITEMS.map((i) => [i.id, 0]))
  for (;;) {
    const rows = await prisma.$queryRaw<
      { id: string; url: string; externalJobId: string | null; aiSkillItems: string[]; aiToolsNamed: string[]; aiCertsNamed: string[] }[]
    >`
      SELECT "id", "url", "externalJobId", "aiSkillItems", "aiToolsNamed", "aiCertsNamed" FROM "ExclusiveJobPosting"
      WHERE "archivedAt" IS NULL AND "id" > ${lo} ORDER BY "id" LIMIT ${PAGE}`
    if (rows.length === 0) break
    lo = rows[rows.length - 1].id
    stat.live += rows.length
    const ids: string[] = []
    const g: string[] = []
    const it: string[] = []
    const tl: string[] = []
    const ct: string[] = []
    for (const r of rows) {
      let hit = byUrl.get(r.url)
      if (hit) stat.matchedUrl++
      else if (r.externalJobId && byExt.get(r.externalJobId)) {
        hit = byExt.get(r.externalJobId)!
        stat.matchedExt++
      }
      if (!hit) continue
      if (hit.n >= FULL_TEXT) stat.fullText++
      if (hit.items.length > 0) stat.anyAi++
      for (const x of hit.groups) groups[x]++
      for (const x of hit.items) items[x]++
      const same =
        hit.items.join('|') === r.aiSkillItems.join('|') && hit.tools.join('|') === r.aiToolsNamed.join('|') && hit.certs.join('|') === r.aiCertsNamed.join('|')
      if (same) continue
      ids.push(r.id)
      g.push(arr(hit.groups))
      it.push(arr(hit.items))
      tl.push(arr(hit.tools))
      ct.push(arr(hit.certs))
    }
    if (!dry && ids.length > 0) {
      await prisma.$executeRaw`
        UPDATE "ExclusiveJobPosting" AS j
        SET "aiSkillGroups" = v.g::text[], "aiSkillItems" = v.i::text[], "aiToolsNamed" = v.t::text[], "aiCertsNamed" = v.c::text[]
        FROM unnest(${ids}::text[], ${g}::text[], ${it}::text[], ${tl}::text[], ${ct}::text[]) AS v(id, g, i, t, c) WHERE j."id" = v.id`
    }
    stat.changed += ids.length
  }
  console.log(JSON.stringify({ ...stat, dry, groups, items }, null, 1))
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
