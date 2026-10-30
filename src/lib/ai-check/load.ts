import 'server-only'
import { prisma } from '@/lib/prisma'
import { loadExposureForSoc, loadExposureMap } from '@/lib/skills/ai-exposure-server'
import { retrainingNeed, type OccupationExposure, type RetrainingNeed } from '@/lib/skills/ai-exposure'
import { pickBets, skillsGap, type Alt, type Bet, type SkillLevels } from './better-bets'

// Everything one AI job check page shows, for a 6-digit SOC code. The exposure number is the only thing the page cannot do
// without; every other part fails soft (a database error hides that section instead of the page).

export interface OccupationCheck {
  exposure: OccupationExposure
  need: RetrainingNeed
  description: string | null
  medianWage: number | null
  growthPct: number | null
  annualOpenings: number | null
  tasks: string[]
  bets: Bet[]
  skillsToBuild: string[]
}

const onet = (soc6: string) => `${soc6}.00`
const SIMILAR_POOL = 25
const GAP_TARGETS = 3

async function softly<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    console.error(`AI job check: ${label} unavailable:`, error)
    return fallback
  }
}

async function skillLevels(socCode: string): Promise<SkillLevels> {
  const rows = await prisma.occupationSkill.findMany({ where: { socCode }, select: { importance: true, skill: { select: { name: true } } } })
  return new Map(rows.map((r) => [r.skill.name, r.importance]))
}

export async function loadOccupationCheck(soc6: string): Promise<OccupationCheck | null> {
  const exposure = await loadExposureForSoc(soc6)
  if (!exposure) return null

  const [occ, tasks, similar, exposureMap] = await Promise.all([
    softly('occupation', () => prisma.occupation.findUnique({ where: { socCode: onet(soc6) }, select: { description: true, medianWage: true, growthPct: true, annualOpenings: true } }), null),
    softly('tasks', () => prisma.occupationTask.findMany({ where: { socCode: onet(soc6), taskType: 'CORE' }, orderBy: { taskId: 'asc' }, take: 4, select: { text: true } }), []),
    softly('similar occupations', () => prisma.occupationSimilarity.findMany({ where: { socCode: onet(soc6) }, orderBy: { score: 'desc' }, take: SIMILAR_POOL, select: { similarSocCode: true, similarTitle: true, score: true } }), []),
    loadExposureMap(),
  ])

  const wages = await softly(
    'related wages',
    () => prisma.occupation.findMany({ where: { socCode: { in: similar.map((s) => s.similarSocCode) } }, select: { socCode: true, medianWage: true } }),
    [],
  )
  const wageOf = new Map(wages.map((w) => [w.socCode, w.medianWage]))
  const alts: Alt[] = similar.map((s) => {
    const alt6 = s.similarSocCode.slice(0, 7)
    return { soc6: alt6, title: s.similarTitle, similarity: s.score, exposure: exposureMap.get(alt6)?.score ?? null, medianWage: wageOf.get(s.similarSocCode) ?? null }
  })
  const bets = pickBets({ soc6, exposure: exposure.score, medianWage: occ?.medianWage ?? null }, alts)

  const skillsToBuild = bets.length
    ? await softly(
        'skills gap',
        async () => {
          const [mine, ...theirs] = await Promise.all([onet(soc6), ...bets.slice(0, GAP_TARGETS).map((b) => onet(b.soc6))].map(skillLevels))
          return skillsGap(mine, theirs)
        },
        [],
      )
    : []

  return {
    exposure,
    need: retrainingNeed(exposure),
    description: occ?.description ?? null,
    medianWage: occ?.medianWage ?? null,
    growthPct: occ?.growthPct ?? null,
    annualOpenings: occ?.annualOpenings ?? null,
    tasks: tasks.map((t) => t.text),
    bets,
    skillsToBuild,
  }
}
