// Measures search breadth on real members: jobs on the board at Narrow vs Wide, example
// skills matches with their labels, and cold / warm timings. Read-only.
//
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/careers/measure-search-breadth.ts <candidateId>...
import { prisma } from '../../src/lib/prisma'
import { loadBoardShortlist } from '../../src/lib/jobs/board-shortlist'
import { memberStageWindow, memberCareerStage } from '../../src/lib/jobs/career-stage'
import { boardBreadthFor, defaultBreadth } from '../../src/lib/jobs/search-breadth'
import { breadthReasonsFor } from '../../src/lib/jobs/search-breadth-server'
import { memberSkillKeywords } from '../../src/lib/jobs/skill-gap-data'
import { inferFunctionFromTitle } from '../../src/lib/jobs/infer-job-function'

async function main() {
  const ids = process.argv.slice(2)
  for (const id of ids) {
    const profile = await prisma.candidateProfile.findUniqueOrThrow({ where: { id } })
    const base = { candidate: profile, isCandidatePlus: true, stageWindow: memberStageWindow(profile), includeMidLevel: true, includeEarlyCareer: true }
    const tw = Date.now()
    await loadBoardShortlist({ ...base, breadth: 'off' })
    const t0 = Date.now()
    const off = await loadBoardShortlist({ ...base, breadth: 'off' })
    const t1 = Date.now()
    const narrow = await loadBoardShortlist({ ...base, breadth: 'narrow' })
    const t2 = Date.now()
    const wide = await loadBoardShortlist({ ...base, breadth: 'wide', size: 300, moreAtLevel: true })
    const t3 = Date.now()
    const wide2 = await loadBoardShortlist({ ...base, breadth: 'wide', size: 300 })
    const t4 = Date.now()
    const c = wide.breadth.classifier
    console.log(`\n=== ${id} | ${profile.highestLevelReached ?? '-'} ${profile.yearsExperience ?? '-'}y | ${profile.primaryFunction}/${profile.secondaryFunction ?? '-'} → ${profile.targetFunction ?? '-'} | "${profile.resumeLatestJobTitle ?? ''}" | ${profile.industryContext ?? ''}`)
    console.log(`stage ${memberCareerStage(profile)} default ${defaultBreadth(profile)} board ${boardBreadthFor(profile)} | soc ${c?.member.soc} source ${c?.member.sourceRole} pivots ${[...(c?.member.pivotTargets.keys() ?? [])].join(',')}`)
    const total = (b: typeof off) => b.openTotal + b.lockedTotal
    console.log(`jobs in window (no breadth) ${total(off)} | narrow ${total(narrow)} (${narrow.breadth.narrowTotal}) | wide ${total(wide)} (${wide.breadth.wideTotal})`)
    console.log(`ms: first load ${t0 - tw} | no-breadth warm ${t1 - t0} | narrow ${t2 - t1} | wide ${t3 - t2} | wide again (warm) ${t4 - t3} | rows ${wide2.open.length}`)
    if (!c) continue
    console.log(`wide main ${total(wide)} + more at your level ${wide.more.total} (ranked ids ${wide.more.ids.length}, first page ${wide.more.first.length})`)
    const fns = c.member.functions
    const oldField = await loadBoardShortlist({ ...base, breadth: 'off', keep: (p) => fns.has((inferFunctionFromTitle(p.title) ?? '').toLowerCase()) })
    const newField = await loadBoardShortlist({ ...base, breadth: 'wide', keep: (p) => c.place(p)?.cls.kind === 'field' })
    const related = await loadBoardShortlist({ ...base, breadth: 'wide', keep: (p) => c.place(p)?.cls.kind === 'related_field' })
    console.log(`member sub-function ${c.member.subFunction} | "Your field": function-level (before) ${total(oldField)} → now ${total(newField)} | related field (Wide) ${total(related)}`)
    const reasons = breadthReasonsFor(c, wide.open, memberSkillKeywords(profile))
    const kinds: Record<string, number> = {}
    for (const r of reasons.values()) kinds[r.kind] = (kinds[r.kind] ?? 0) + 1
    console.log('top-300 wide by reason', kinds)
    const skillsOnly = await loadBoardShortlist({ ...base, breadth: 'wide', keep: (p) => c.place(p)?.cls.kind === 'skills' })
    const skillReasons = breadthReasonsFor(c, skillsOnly.open, memberSkillKeywords(profile))
    console.log(`skills matches: ${skillsOnly.openTotal + skillsOnly.lockedTotal} (narrow-eligible ${skillsOnly.breadth.narrowTotal})`)
    const shown = new Set<string>()
    for (const p of skillsOnly.open) {
      const r = skillReasons.get(p.id)
      if (r?.kind !== 'skills' || shown.size >= 10 || shown.has(p.title)) continue
      shown.add(p.title)
      console.log(`  skills: ${p.title} @ ${p.companyName} [${p.socTitle}] → ${r.label}`)
    }
    let n = 0
    const pivots = await loadBoardShortlist({ ...base, breadth: 'narrow', keep: (p) => c.place(p)?.cls.kind === 'pivot' })
    const pivotReasons = breadthReasonsFor(c, pivots.open, memberSkillKeywords(profile))
    console.log(`pivot jobs: ${pivots.openTotal + pivots.lockedTotal}`)
    for (const p of pivots.open) {
      const r = pivotReasons.get(p.id)
      if (r?.kind === 'pivot') {
        if (n++ < 4) console.log(`  pivot: ${p.title} @ ${p.companyName} → ${r.label}`)
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
