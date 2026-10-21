// Learn in the redesign: an AI skill the member's best-fit employers ask for and the member lacks becomes a
// candidate for the featured course, with the reason attached. Pure, so it is tested without the database.
// Only AI gaps that a tagged catalog course covers (ai-course-tags.ts) produce a candidate, and at least
// MIN_EMPLOYERS of the member's best-fit employers must ask for the skill, so one odd posting never decides it.
import { courseForAiSkill } from '@/lib/learning/ai-course-tags'
import { toLearningResource } from '@/lib/learning/courses'
import type { LearningPlanItem } from '@/lib/learning/build-learning-plan'
import type { Course } from '@prisma/client'

export const MIN_EMPLOYERS = 3

export interface AiGapInput {
  term: string
  ai: boolean
  have: boolean
  employers: number
}

/** One LearningPlanItem per course that closes a qualifying AI gap, most-asked skill first, one per course. */
export function aiGapCourseItems(rows: AiGapInput[], employersWithSkillData: number, catalog: Course[]): LearningPlanItem[] {
  const seen = new Set<string>()
  const out: LearningPlanItem[] = []
  const gaps = rows.filter((r) => r.ai && !r.have && r.employers >= MIN_EMPLOYERS).sort((a, b) => b.employers - a.employers)
  for (const g of gaps) {
    const course = courseForAiSkill(g.term, catalog)
    if (!course || seen.has(course.id)) continue
    seen.add(course.id)
    out.push({
      ...toLearningResource(course),
      rationale: `${g.employers} of ${employersWithSkillData} employers with jobs that fit you ask for “${g.term}”, and it isn’t on your profile yet. This course covers it.`,
      completionCount: 0,
      alreadyHeld: false,
    })
  }
  return out
}
