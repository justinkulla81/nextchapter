// Read-only. Scans live board postings with the AI skills taxonomy and prints how often each
// AI skill is asked for, by role tier and by job function, so the taxonomy can be checked
// against the real market before it is built into anything. Writes nothing.
//
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/ai-skills/analyze-postings.ts [--json out.json] [--samples 3]
import { writeFileSync } from 'node:fs'
import { prisma } from '../../src/lib/prisma'
import { AI_SKILLS, readPostingAi, type AiRoleTier } from '../../src/lib/ai-skills/taxonomy'
import { inferFunctionFromTitle as inferJobFunction } from '../../src/lib/jobs/infer-job-function'

const PAGE = 5000
const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined }

async function main() {
  const samplesPer = Number(arg('--samples') ?? 3)
  let lo = ''
  let total = 0
  let withText = 0
  const tiers: Record<string, number> = { builder: 0, embedded: 0, adjacent: 0 }
  const bySkill: Record<string, { n: number; aware: number; practitioner: number; builder: number; samples: string[] }> = {}
  const byFn: Record<string, { jobs: number; ai: number; skills: Record<string, number> }> = {}
  for (const s of AI_SKILLS) bySkill[s.key] = { n: 0, aware: 0, practitioner: 0, builder: 0, samples: [] }

  for (;;) {
    const rows = await prisma.$queryRaw<{ id: string; title: string; description: string | null; skills: string[]; companyName: string }[]>`
      SELECT "id", "title", "description", "skills", "companyName" FROM "ExclusiveJobPosting"
      WHERE "archivedAt" IS NULL AND "status" = 'approved' AND "id" > ${lo} ORDER BY "id" LIMIT ${PAGE}`
    if (rows.length === 0) break
    lo = rows[rows.length - 1].id
    for (const r of rows) {
      total++
      if (r.description && r.description.length > 200) withText++
      const fn = inferJobFunction(r.title) ?? 'Unclassified'
      const f = (byFn[fn] ??= { jobs: 0, ai: 0, skills: {} })
      f.jobs++
      const read = readPostingAi(r.title, r.description, r.skills.join(' , '))
      if (!read.tier) continue
      tiers[read.tier as AiRoleTier]++
      f.ai++
      for (const s of read.skills) {
        const b = bySkill[s.key]
        b.n++
        b[s.level]++
        f.skills[s.key] = (f.skills[s.key] ?? 0) + 1
        if (b.samples.length < samplesPer) b.samples.push(`${r.title} @ ${r.companyName}`)
      }
    }
  }

  const aiTotal = tiers.builder + tiers.embedded + tiers.adjacent
  console.log(`\n${total} live approved jobs; ${withText} carry >200 chars of description (${((withText / Math.max(total, 1)) * 100).toFixed(1)}%)`)
  console.log(`AI-related: ${aiTotal} (${((aiTotal / Math.max(total, 1)) * 100).toFixed(2)}%)  builder ${tiers.builder} · embedded ${tiers.embedded} · adjacent ${tiers.adjacent}\n`)
  console.log('Skill'.padEnd(34), 'jobs'.padStart(6), 'aware'.padStart(6), 'pract'.padStart(6), 'build'.padStart(6))
  for (const s of AI_SKILLS.slice().sort((a, b) => bySkill[b.key].n - bySkill[a.key].n)) {
    const b = bySkill[s.key]
    console.log(s.label.padEnd(34), String(b.n).padStart(6), String(b.aware).padStart(6), String(b.practitioner).padStart(6), String(b.builder).padStart(6))
    for (const x of b.samples) console.log('   e.g.', x)
  }
  console.log('\nBy job function (AI-related share):')
  for (const [fn, f] of Object.entries(byFn).sort((a, b) => b[1].ai - a[1].ai).slice(0, 15)) {
    const top = Object.entries(f.skills).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k}:${n}`).join(', ')
    console.log(fn.padEnd(26), `${f.ai}/${f.jobs}`.padStart(12), ` ${((f.ai / Math.max(f.jobs, 1)) * 100).toFixed(1)}%  ${top}`)
  }
  const out = arg('--json')
  if (out) writeFileSync(out, JSON.stringify({ total, withText, tiers, bySkill, byFn }, null, 1))
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
