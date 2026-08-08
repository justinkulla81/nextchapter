import 'server-only'
import { prisma } from '@/lib/prisma'
import type { Course } from '@prisma/client'
import type { LearningResource } from '@/lib/constants/learning-partners'

export { COURSE_SKILL_LEVELS, COURSE_SKILL_LEVEL_LABELS, defaultSkillLevel } from '@/lib/constants/course-skill-level'

// Every active course across every category — fetched once per Learning
// page render, then filtered/grouped by category in build-learning-plan.ts
// (mirrors how the old static-constants files were imported and filtered
// per section, just from one query instead of five separate array
// imports).
export async function getActiveCourses(): Promise<Course[]> {
  return prisma.course.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
}

export function toLearningResource(course: Course): LearningResource {
  return {
    title: course.title,
    sponsor: course.sponsor ?? undefined,
    description: course.description,
    url: course.url,
    provider: course.provider,
    free: course.free,
    actionType: 'LEARNING_MODULE',
    logoUrl: course.logoUrl,
  }
}

// Every course title, active or not — used only by the email
// completion-detection matcher (sync-gmail.ts): it needs to recognize a
// title in a "you completed X" email regardless of who took it or whether
// an admin has since deactivated it.
export async function getAllCourseTitles(): Promise<string[]> {
  const courses = await prisma.course.findMany({ select: { title: true } })
  return courses.map((c) => c.title)
}
