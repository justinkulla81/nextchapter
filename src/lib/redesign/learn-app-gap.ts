// Learning ordering from the member's applications (src/lib/applications): the top recommended skills
// (applications, best-fit market, AI pay lift) that a catalog course covers become course candidates
// with the reason attached, ahead of the AI-gap and general picks. Pure, so it is tested without the database.
import { toLearningResource } from '@/lib/learning/courses'
import type { LearningPlanItem } from '@/lib/learning/build-learning-plan'
import type { Course } from '@prisma/client'

export interface AppGapRecommendation {
  term: string
  reason: string
}

/** One LearningPlanItem per course that closes a recommended skill, in recommendation order, one per course. */
export function applicationGapCourseItems(
  recs: AppGapRecommendation[],
  catalog: Course[],
  courseFor: (term: string, catalog: Course[]) => Course | null,
): LearningPlanItem[] {
  const seen = new Set<string>()
  const out: LearningPlanItem[] = []
  for (const r of recs) {
    const course = courseFor(r.term, catalog)
    if (!course || seen.has(course.id)) continue
    seen.add(course.id)
    out.push({ ...toLearningResource(course), rationale: `${r.reason} This course covers “${r.term}”.`, completionCount: 0, alreadyHeld: false })
  }
  return out
}
