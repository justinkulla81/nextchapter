// What AI skills a person shows today, and at what level, from evidence we already hold:
// the skills matrix (resume, confirmed, certified), completed courses, AI projects and the AI
// tools they say they use. Pure and client-safe; no model calls.
import type { SkillRow } from '@/lib/profile/skill-matrix'
import { AI_LEVEL_RANK, matchAiSkills, type AiLevel } from '@/lib/ai-skills/taxonomy'

export type AiLevels = Record<string, AiLevel>
export type AiEvidence = { skill: string; level: AiLevel; why: string }

// Matrix levels read as AI levels: named once on a resume = aware; confirmed or certified = practitioner;
// a level the person set to expert = builder.
const FROM_MATRIX: Record<SkillRow['level'], AiLevel> = { used: 'aware', strong: 'practitioner', expert: 'builder' }
// A course teaches up to its own level; finishing a beginner course makes you aware, not a practitioner.
export const COURSE_LEVEL: Record<'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED', AiLevel> = { BEGINNER: 'aware', INTERMEDIATE: 'practitioner', ADVANCED: 'builder' }

export type PersonAiInput = {
  matrix: Pick<SkillRow, 'label' | 'level'>[]
  completedCourses: { skills: string[]; level: AiLevel }[]
  aiProjects: { title: string; description?: string | null }[]
  familiarTools: string[]
}

export function personAiLevels(input: PersonAiInput): { levels: AiLevels; evidence: AiEvidence[] } {
  const levels: AiLevels = {}
  const evidence: AiEvidence[] = []
  const raise = (skill: string, level: AiLevel, why: string) => {
    if (!levels[skill] || AI_LEVEL_RANK[level] > AI_LEVEL_RANK[levels[skill]]) {
      levels[skill] = level
      evidence.push({ skill, level, why })
    }
  }
  for (const row of input.matrix) for (const s of matchAiSkills(row.label)) raise(s.key, FROM_MATRIX[row.level], `“${row.label}” in your skills`)
  for (const c of input.completedCourses) for (const k of c.skills) raise(k, c.level, 'A course you completed')
  for (const p of input.aiProjects) {
    const hit = matchAiSkills(`${p.title} ${p.description ?? ''}`)
    raise('ai-tools', 'practitioner', `AI project: ${p.title}`)
    for (const s of hit) raise(s.key, 'practitioner', `AI project: ${p.title}`)
  }
  const toolSkills = input.familiarTools.flatMap((t) => matchAiSkills(t))
  if (input.familiarTools.length > 0) raise('ai-tools', input.familiarTools.length >= 3 ? 'practitioner' : 'aware', `${input.familiarTools.length} AI tool${input.familiarTools.length === 1 ? '' : 's'} you use`)
  for (const s of toolSkills) raise(s.key, 'aware', 'An AI tool you use')
  return { levels, evidence }
}
