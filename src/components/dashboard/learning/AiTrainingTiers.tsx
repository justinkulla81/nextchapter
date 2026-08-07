'use client'

import { useState } from 'react'
import { usePostHog } from 'posthog-js/react'
import { AI_TRAINING_TIER_LABELS, type AiTrainingTier } from '@/lib/constants/ai-training-tiers'
import { AI_TRAINING_COURSES } from '@/lib/constants/ai-training-tiers'
import { LearningResourceCard } from '@/components/dashboard/learning/LearningResourceCard'
import type { LearningPlanItem } from '@/lib/learning/build-learning-plan'
import { cn } from '@/lib/utils'

const TIERS: AiTrainingTier[] = ['foundational', 'practical', 'technical']

// 3 discrete options → adjacent buttons, per the 2-4-options design rule.
// Defaults to the tier calibrated off aiFlexibilityLevel (build-learning-
// plan.ts), but all three stay clickable regardless — this is a starting
// point, not a lock.
export function AiTrainingTiers({
  defaultTier,
  defaultCourses,
  completedTitles,
}: {
  defaultTier: AiTrainingTier
  defaultCourses: LearningPlanItem[]
  completedTitles: Set<string>
}) {
  const [tier, setTier] = useState<AiTrainingTier>(defaultTier)
  const posthog = usePostHog()
  const courses =
    tier === defaultTier ? defaultCourses : AI_TRAINING_COURSES[tier].map((c) => ({ ...c, rationale: null, completionCount: 0 }))

  function selectTier(t: AiTrainingTier) {
    setTier(t)
    posthog?.capture('learning_ai_tier_selected', { tier: t, wasDefault: t === defaultTier })
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {TIERS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => selectTier(t)}
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
              tier === t
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground hover:bg-muted'
            )}
          >
            {AI_TRAINING_TIER_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {courses.map((course) => (
          <LearningResourceCard
            key={course.title}
            item={course}
            section="ai_training"
            completed={completedTitles.has(course.title)}
          />
        ))}
      </div>
    </div>
  )
}
