'use client'

import { useEffect, useState } from 'react'
import { fetchSkillGapSuggestions } from '@/app/dashboard/skills-assessment/actions'
import { SkillsToBuildForm } from '@/components/dashboard/SkillsToBuildForm'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import type { SkillGapSuggestions } from '@/lib/skills/skill-gap-suggestions'

// Fetches suggestions client-side on mount rather than up front on the
// server — this section only ever mounts once the questionnaire above has
// been saved at least once in this session, so a first-time candidate's
// suggestions are generated from the target-role/AI-comfort answers they
// just gave, not stale pre-submission values (see fetchSkillGapSuggestions'
// own comment). Self-caching server-side, so this is cheap on every later
// visit/retake.
export function SkillsNeedSection({
  initialSkills,
  targetRole,
}: {
  initialSkills: string[]
  targetRole: string | null
}) {
  const [suggestions, setSuggestions] = useState<SkillGapSuggestions | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    fetchSkillGapSuggestions().then((result) => {
      if (!cancelled) setSuggestions(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-2">
      <div>
        <Label>3. Skills You Need to Build</Label>
        <p className="text-sm text-muted-foreground">
          Skills worth building for your next job — pick from the suggestions below or add your
          own. Feeds your Learning recommendations and Coaching Notes.
        </p>
      </div>
      {suggestions === undefined ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size={16} />
          Putting together skill suggestions…
        </div>
      ) : (
        <SkillsToBuildForm initialSkills={initialSkills} suggestions={suggestions} targetRole={targetRole} />
      )}
    </div>
  )
}
