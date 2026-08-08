// Pure constants/helpers for CourseSkillLevel — split out from
// src/lib/learning/courses.ts (which is 'server-only', Prisma-backed) so
// client components (AiTrainingTiers, AiContextBanner) can import the
// labels/mapping without pulling a server-only module into the client
// bundle.
import type { CourseSkillLevel } from '@prisma/client'

export const COURSE_SKILL_LEVELS: CourseSkillLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']

export const COURSE_SKILL_LEVEL_LABELS: Record<CourseSkillLevel, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
}

// Same aiFlexibilityLevel thresholds the old foundational/practical/
// technical tiers used — a candidate who told us they're still getting
// comfortable with AI day to day defaults to Beginner content, someone
// already building with AI defaults to Advanced.
export function defaultSkillLevel(aiFlexibilityLevel: number | null): CourseSkillLevel {
  if (aiFlexibilityLevel === null || aiFlexibilityLevel <= 25) return 'BEGINNER'
  if (aiFlexibilityLevel <= 75) return 'INTERMEDIATE'
  return 'ADVANCED'
}
