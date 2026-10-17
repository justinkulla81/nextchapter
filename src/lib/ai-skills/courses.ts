// Which AI skills a catalog course teaches, and up to what level. Inferred from the course's own
// text through the same taxonomy that reads postings, so an admin-added course joins the gap view
// with no tagging step. A generic AI course that names no specific skill still teaches the basics.
import { COURSE_LEVEL } from '@/lib/ai-skills/person'
import { AI_LEVEL_RANK, matchAiSkills, type AiLevel } from '@/lib/ai-skills/taxonomy'

export type CourseLike = {
  title: string
  description: string
  skillLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  category?: string
}
export type CourseAi = { skills: string[]; level: AiLevel }

export function courseAi(c: CourseLike): CourseAi | null {
  const level = COURSE_LEVEL[c.skillLevel]
  const named = matchAiSkills(`${c.title}. ${c.description}`).map((s) => s.key)
  const isAi = c.category === 'AI_TRAINING' || named.length > 0 || /\b(?:ai|artificial intelligence|machine learning|generative)\b/i.test(c.title)
  if (!isAi) return null
  // The beginner generics: "AI for Everyone", "AI Essentials" teach what AI is and how to use it day to day.
  const generic = level === 'aware' ? ['ai-tools'] : level === 'practitioner' ? ['ai-tools', 'prompting'] : ['ml-foundations']
  return { skills: named.length > 0 ? named : generic, level }
}

/** Courses that close a gap: teach the skill at or above the level wanted (or the nearest below), cheapest first. */
export function coursesFor<T extends CourseLike & { free: boolean }>(skill: string, wanted: AiLevel, have: AiLevel | null, courses: T[], max = 2): T[] {
  const scored = courses
    .map((c) => ({ c, ai: courseAi(c) }))
    .filter((x): x is { c: T; ai: CourseAi } => !!x.ai && x.ai.skills.includes(skill))
    // Skip courses that would not move the person: at or below the level they already have.
    .filter((x) => !have || AI_LEVEL_RANK[x.ai.level] > AI_LEVEL_RANK[have])
  scored.sort((a, b) => {
    const da = Math.abs(AI_LEVEL_RANK[a.ai.level] - AI_LEVEL_RANK[wanted])
    const db = Math.abs(AI_LEVEL_RANK[b.ai.level] - AI_LEVEL_RANK[wanted])
    return da - db || Number(b.c.free) - Number(a.c.free)
  })
  return scored.slice(0, max).map((x) => x.c)
}
