// The catalog course for a skill, for "Learn it". Pure; tested in src/test/application-skill-snapshot.test.ts.
import type { Course } from '@prisma/client'
import { aiSkillLabelsForCourse, courseForAiSkill } from '@/lib/learning/ai-course-tags'
import { aiSkillIdForLabel } from '@/lib/skills/ai-skills'

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The catalog course for a skill: the course tagged for it when it is an AI skill (ai-course-tags.ts),
 * else the first active course whose title names the skill as a whole word, or that carries it as a keyword.
 * AI-tagged courses are only offered for AI skills. Descriptions are not read: "excel" in "excel at leading teams" is not an Excel course.
 */
export function courseForSkill<C extends Pick<Course, 'url' | 'title' | 'keywords'>>(term: string, catalog: C[]): C | null {
  if (aiSkillIdForLabel(term)) return courseForAiSkill(term, catalog)
  const t = term.trim().toLowerCase()
  if (t.length < 2) return null
  const re = new RegExp(`(?:^|[^a-z0-9])${escapeRe(t)}(?:[^a-z0-9]|$)`, 'i')
  // An AI course ("Advanced in AI Audit") is never the course for the general skill ("audit").
  const general = catalog.filter((c) => aiSkillLabelsForCourse(c.url).length === 0)
  return general.find((c) => re.test(c.title)) ?? catalog.find((c) => c.keywords.some((k) => k.toLowerCase() === t)) ?? null
}

