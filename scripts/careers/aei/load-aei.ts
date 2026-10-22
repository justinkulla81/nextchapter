// Loads the Anthropic Economic Index build (build-aei-occupations.py's JSON) into AeiOccupation,
// AeiTask, AeiTaskSkill and AeiSkill (prisma/manual/2026-10-22-aei-exposure.sql). Replaces the
// AEI tables' rows in one transaction each; touches no other table. No API call.
//
//   /usr/bin/python3 -I scripts/careers/aei/build-aei-occupations.py ~/nextchapter-jobs/data/aei \
//       ~/nextchapter-jobs/data/aei-derived ~/nextchapter-jobs/data/onet/text_31_0 0.01
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/careers/aei/load-aei.ts \
//       ~/nextchapter-jobs/data/aei-derived [--dry-run]
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../../../src/lib/prisma'
import { AEI_RELEASE, exposureLevelFor, TASK_USE_THRESHOLD_PCT } from '../../../src/lib/aei/job-exposure'
import { taskSkillLinks } from '../../../src/lib/aei/task-skills'

type OccIn = {
  socCode: string
  title: string
  taskCount: number
  tasksUsed: number
  taskCoveragePct: number | null
  convSharePct: number | null
  apiSharePct: number | null
  automationPct: number | null
  augmentationPct: number | null
  observedExposure: number | null
  topTasks: unknown[]
  basis: string
}
type TaskIn = {
  taskId: number
  socCode: string
  text: string
  claudePct: number | null
  apiPct: number | null
  automationPct: number | null
  augmentationPct: number | null
  covered: boolean
}

const MIN_SKILL_TASKS = 3

async function main() {
  const dir = process.argv[2]
  const dry = process.argv.includes('--dry-run')
  if (!dir) throw new Error('usage: load-aei.ts <derived dir> [--dry-run]')
  const build = JSON.parse(readFileSync(join(dir, 'aei_occupations.json'), 'utf8')) as { release: string; threshold: number; occupations: OccIn[] }
  if (build.release !== AEI_RELEASE) throw new Error(`build is ${build.release}, code expects ${AEI_RELEASE}`)
  if (build.threshold !== TASK_USE_THRESHOLD_PCT) throw new Error(`build threshold ${build.threshold} != ${TASK_USE_THRESHOLD_PCT}`)
  const tasks = JSON.parse(readFileSync(join(dir, 'aei_tasks.json'), 'utf8')) as TaskIn[]

  const occs = build.occupations
    .map((o) => ({ ...o, level: exposureLevelFor(o.taskCoveragePct) }))
    .filter((o): o is OccIn & { level: NonNullable<ReturnType<typeof exposureLevelFor>> } => o.level !== null)
  const levels: Record<string, number> = {}
  for (const o of occs) levels[o.level] = (levels[o.level] ?? 0) + 1
  console.log(`${occs.length} occupations`, levels)

  // Task -> skill links over the covered tasks, then each skill's usage-weighted split.
  const skillNames = new Map((await prisma.skill.findMany({ select: { id: true, name: true } })).map((s) => [s.id, s.name]))
  const links: { taskId: number; skillId: string; via: string }[] = []
  const bySkill = new Map<string, TaskIn[]>()
  for (const t of tasks) {
    if (!t.covered) continue
    for (const l of taskSkillLinks(t.text)) {
      if (!skillNames.has(l.skillId)) continue
      links.push({ taskId: t.taskId, skillId: l.skillId, via: l.via })
      const list = bySkill.get(l.skillId) ?? []
      list.push(t)
      bySkill.set(l.skillId, list)
    }
  }
  const skills = [...bySkill]
    .filter(([, ts]) => ts.length >= MIN_SKILL_TASKS)
    .map(([skillId, ts]) => {
      const usage = ts.reduce((s, t) => s + (t.claudePct ?? 0), 0)
      const w = ts.filter((t) => t.automationPct !== null && (t.claudePct ?? 0) > 0)
      const tw = w.reduce((s, t) => s + (t.claudePct ?? 0), 0)
      const top = [...ts].sort((a, b) => (b.claudePct ?? 0) - (a.claudePct ?? 0))[0]
      return {
        skillId,
        name: skillNames.get(skillId)!,
        taskCount: ts.length,
        usagePct: Math.round(usage * 1000) / 1000,
        automationPct: tw > 0 ? Math.round((10 * w.reduce((s, t) => s + t.automationPct! * (t.claudePct ?? 0), 0)) / tw) / 10 : null,
        augmentationPct: tw > 0 ? Math.round((10 * w.reduce((s, t) => s + (t.augmentationPct ?? 0) * (t.claudePct ?? 0), 0)) / tw) / 10 : null,
        topTask: top?.text ?? null,
      }
    })
  console.log(`${tasks.length} tasks, ${links.length} task-skill links, ${skills.length} skills with >= ${MIN_SKILL_TASKS} tasks`)
  for (const s of [...skills].sort((a, b) => (b.automationPct ?? 0) - (a.automationPct ?? 0)).slice(0, 8)) console.log('  most automated', s.name, s.automationPct, s.taskCount)
  for (const s of [...skills].sort((a, b) => (b.augmentationPct ?? 0) - (a.augmentationPct ?? 0)).slice(0, 8)) console.log('  most augmented', s.name, s.augmentationPct, s.taskCount)
  if (dry) return

  const now = new Date()
  await prisma.$transaction(
    async (tx) => {
      await tx.aeiOccupation.deleteMany({})
      await tx.aeiOccupation.createMany({
        data: occs.map((o) => ({
          socCode: o.socCode,
          title: o.title,
          release: build.release,
          basis: o.basis.startsWith('related') ? 'related' : 'tasks',
          taskCount: o.taskCount,
          tasksUsed: o.tasksUsed,
          taskCoveragePct: o.taskCoveragePct,
          convSharePct: o.convSharePct,
          apiSharePct: o.apiSharePct,
          automationPct: o.automationPct,
          augmentationPct: o.augmentationPct,
          observedExposure: o.observedExposure,
          exposureLevel: o.level,
          topTasks: o.topTasks as object[],
          updatedAt: now,
        })),
      })
      await tx.aeiTaskSkill.deleteMany({})
      await tx.aeiTask.deleteMany({})
      await tx.aeiTask.createMany({
        data: tasks.map((t) => ({
          taskId: t.taskId,
          socCode: t.socCode,
          text: t.text,
          usagePct: t.claudePct,
          apiUsagePct: t.apiPct,
          automationPct: t.automationPct,
          augmentationPct: t.augmentationPct,
          covered: t.covered,
        })),
      })
      await tx.aeiTaskSkill.createMany({ data: links })
      await tx.aeiSkill.deleteMany({})
      await tx.aeiSkill.createMany({ data: skills })
    },
    { timeout: 120_000 }
  )
  console.log('loaded')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
