// Which of a member's skills AI mostly automates vs augments, from the Anthropic Economic Index:
// each skill's usage-weighted split over the AEI tasks linked to it (AeiSkill, task-skills.ts).
// Feeds the skills matrix and the Learning gap view: an augmented skill is one to learn to use AI
// on; an automated one is work people already hand to AI whole. Pure.

import { textSkillIds } from '@/lib/careers/text-skill-ids'
import { collabModeFor } from '@/lib/aei/job-exposure'
import { TASK_SKILL_RULES } from '@/lib/aei/task-skills'

export interface AeiSkillLike {
  skillId: string
  name: string
  taskCount: number
  automationPct: number | null
  augmentationPct: number | null
  topTask: string | null
}

/** Member skill words that name one of the AEI-linked skills but no task verb would ("Python" → Programming). */
const LABEL_RULES: { skillId: string; pattern: RegExp }[] = [
  { skillId: 'skill:2.B.3.e', pattern: /\b(python|java|javascript|typescript|sql|c\+\+|c#|golang|ruby|rust|scala|react|node(\.js)?|software development|software engineering)\b/i },
  { skillId: 'skill:2.A.1.c', pattern: /\b(copywriting|technical writing|content writing|grant writing|proposal writing)\b/i },
  { skillId: 'skill:2.A.1.e', pattern: /\b(data analysis|analytics|statistics|financial modell?ing|forecasting)\b/i },
  { skillId: 'skill:2.B.1.e', pattern: /\b(training|teaching|mentoring|onboarding)\b/i },
  { skillId: 'skill:2.A.1.d', pattern: /\b(public speaking|presentations?|storytelling)\b/i },
  { skillId: 'skill:2.B.1.f', pattern: /\b(customer service|customer success|client relations|account management)\b/i },
  { skillId: 'skill:2.B.5.b', pattern: /\b(budget(ing)?|p&l|financial planning|fp&a)\b/i },
  { skillId: 'skill:2.B.5.d', pattern: /\b(recruiting|talent acquisition|people management|team leadership|hiring)\b/i },
  { skillId: 'skill:2.B.1.b', pattern: /\b(project management|program management|stakeholder management|cross-functional)\b/i },
  { skillId: 'knowledge:2.C.1.d', pattern: /\b(sales|business development|seo|sem|brand|digital marketing|demand generation)\b/i },
  { skillId: 'knowledge:2.C.1.c', pattern: /\b(gaap|ifrs|financial reporting|bookkeeping|accounts payable|accounts receivable)\b/i },
  { skillId: 'knowledge:2.C.8.b', pattern: /\b(contracts?|compliance|regulatory|litigation)\b/i },
]

export interface SkillAiUse {
  skill: string
  /** The member's own words for it, as they appear on their profile. */
  yourLabel: string
  automationPct: number
  augmentationPct: number
  topTask: string | null
}

export function memberSkillAiUse(labels: readonly string[], aeiSkills: readonly AeiSkillLike[], max = 4): { automated: SkillAiUse[]; augmented: SkillAiUse[] } {
  const byId = new Map(aeiSkills.map((s) => [s.skillId, s]))
  const byName = new Map(aeiSkills.map((s) => [s.name.toLowerCase(), s]))
  const picked = new Map<string, { s: AeiSkillLike; label: string }>()
  for (const raw of labels) {
    const label = raw.trim()
    if (!label) continue
    const ids = new Set<string>(textSkillIds(label))
    for (const r of [...TASK_SKILL_RULES, ...LABEL_RULES]) if (r.pattern.test(label)) ids.add(r.skillId)
    const named = byName.get(label.toLowerCase())
    if (named) ids.add(named.skillId)
    // One AEI skill per label: the one with the most linked tasks (the best-evidenced split).
    const best = [...ids].map((id) => byId.get(id)).filter((s): s is AeiSkillLike => !!s).sort((a, b) => b.taskCount - a.taskCount)[0]
    if (best && !picked.has(best.skillId)) picked.set(best.skillId, { s: best, label })
  }
  const automated: SkillAiUse[] = []
  const augmented: SkillAiUse[] = []
  for (const { s, label } of picked.values()) {
    if (s.automationPct === null || s.augmentationPct === null) continue
    const row = { skill: s.name, yourLabel: label, automationPct: s.automationPct, augmentationPct: s.augmentationPct, topTask: s.topTask }
    const mode = collabModeFor(s.automationPct, s.augmentationPct)
    if (mode === 'automates') automated.push(row)
    else if (mode === 'augments') augmented.push(row)
  }
  automated.sort((a, b) => b.automationPct - a.automationPct)
  augmented.sort((a, b) => b.augmentationPct - a.augmentationPct)
  return { automated: automated.slice(0, max), augmented: augmented.slice(0, max) }
}
