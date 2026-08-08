'use client'

import { useState } from 'react'
import { usePostHog } from 'posthog-js/react'
import type { CourseSkillLevel } from '@prisma/client'
import { COURSE_SKILL_LEVELS, COURSE_SKILL_LEVEL_LABELS } from '@/lib/constants/course-skill-level'
import { LearningResourceCard } from '@/components/dashboard/learning/LearningResourceCard'
import type { LearningPlanItem } from '@/lib/learning/build-learning-plan'
import { cn } from '@/lib/utils'

// 3 discrete options → adjacent buttons, per the 2-4-options design rule.
// Defaults to the level calibrated off aiFlexibilityLevel (build-learning-
// plan.ts), but all three stay clickable regardless — this is a starting
// point, not a lock. coursesByLevel comes in as a prop (not a static
// import) since the catalog is admin-managed in the Course table now —
// a client component can't query Prisma directly, so build-learning-
// plan.ts fetches every level server-side and hands the whole map down.
export function AiTrainingTiers({
  defaultTier,
  coursesByLevel,
  completedTitles,
}: {
  defaultTier: CourseSkillLevel
  coursesByLevel: Record<CourseSkillLevel, LearningPlanItem[]>
  completedTitles: Set<string>
}) {
  const [tier, setTier] = useState<CourseSkillLevel>(defaultTier)
  const posthog = usePostHog()
  const courses = coursesByLevel[tier]

  function selectTier(t: CourseSkillLevel) {
    setTier(t)
    posthog?.capture('learning_ai_tier_selected', { tier: t, wasDefault: t === defaultTier })
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          Skill level
        </p>
        <div className="flex flex-wrap gap-2">
          {COURSE_SKILL_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => selectTier(level)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                tier === level
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:bg-muted'
              )}
            >
              {COURSE_SKILL_LEVEL_LABELS[level]}
              {level === defaultTier && (
                <span
                  className={cn(
                    'ml-1.5 text-xs font-normal',
                    tier === level ? 'text-primary-foreground/80' : 'text-muted-foreground'
                  )}
                >
                  · Recommended for you
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {courses.length === 0 ? (
          <p className="text-sm text-muted-foreground sm:col-span-2">
            No {COURSE_SKILL_LEVEL_LABELS[tier].toLowerCase()} courses yet — check back soon.
          </p>
        ) : (
          courses.map((course) => (
            <LearningResourceCard
              key={course.title}
              item={course}
              section="ai_training"
              completed={completedTitles.has(course.title)}
            />
          ))
        )}
      </div>
    </div>
  )
}
