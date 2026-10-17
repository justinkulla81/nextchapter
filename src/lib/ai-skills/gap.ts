// The AI skills gap: across a set of jobs, which AI skills they ask for, at what level, and how the
// person compares. Pure; the loader (load.ts) supplies the jobs and the person.
import { AI_LEVEL_RANK, AI_SKILL_BY_KEY, type AiLevel, type AiRoleTier, type PostingAiRead } from '@/lib/ai-skills/taxonomy'
import type { AiLevels } from '@/lib/ai-skills/person'

export type AiGapRow = {
  key: string
  label: string
  summary: string
  askedBy: number
  /** The level most of those jobs imply (the lower of two when they tie). */
  requiredLevel: AiLevel
  haveLevel: AiLevel | null
  status: 'covered' | 'build' | 'missing'
}

export type AiGap = {
  jobsRead: number
  jobsWithAi: number
  tiers: Record<AiRoleTier, number>
  rows: AiGapRow[]
}

const MAX_ROWS = 6

export function aggregateAiGap(reads: PostingAiRead[], have: AiLevels): AiGap {
  const tiers: Record<AiRoleTier, number> = { builder: 0, embedded: 0, adjacent: 0 }
  const per = new Map<string, Record<AiLevel, number>>()
  let jobsWithAi = 0
  for (const r of reads) {
    if (!r.tier) continue
    jobsWithAi++
    tiers[r.tier]++
    for (const s of r.skills) {
      const c = per.get(s.key) ?? { aware: 0, practitioner: 0, builder: 0 }
      c[s.level]++
      per.set(s.key, c)
    }
  }
  const rows: AiGapRow[] = []
  for (const [key, c] of per) {
    const skill = AI_SKILL_BY_KEY[key]
    if (!skill) continue
    const askedBy = c.aware + c.practitioner + c.builder
    // Mode of the implied levels, ties to the lower one.
    const requiredLevel = (['aware', 'practitioner', 'builder'] as AiLevel[]).reduce((best, l) => (c[l] > c[best] ? l : best), 'aware' as AiLevel)
    const haveLevel = have[key] ?? null
    const status: AiGapRow['status'] = !haveLevel ? 'missing' : AI_LEVEL_RANK[haveLevel] >= AI_LEVEL_RANK[requiredLevel] ? 'covered' : 'build'
    rows.push({ key, label: skill.label, summary: skill.summary, askedBy, requiredLevel, haveLevel, status })
  }
  // Gaps first (what to work on), then by how many jobs ask; ignore skills only one or two jobs mention.
  const floor = Math.max(3, Math.round(jobsWithAi * 0.05))
  rows.sort((a, b) => Number(a.status === 'covered') - Number(b.status === 'covered') || b.askedBy - a.askedBy)
  return { jobsRead: reads.length, jobsWithAi, tiers, rows: rows.filter((r) => r.askedBy >= floor).slice(0, MAX_ROWS) }
}
