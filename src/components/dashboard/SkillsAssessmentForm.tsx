'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { updateSkillsAssessment } from '@/app/dashboard/skills-assessment/actions'
import { SkillsHaveForm } from '@/components/dashboard/SkillsHaveForm'
import { SkillsNeedSection } from '@/components/dashboard/SkillsNeedSection'
import { SkillsUnlockDialog } from '@/components/dashboard/SkillsUnlockDialog'
import { SubmitButton } from '@/components/ui/submit-button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ConfidenceSlider } from '@/components/onboarding/ConfidenceSlider'
import { MultiChoiceButtons } from '@/components/onboarding/MultiChoiceButtons'
import {
  TOP_STRENGTH_OPTIONS,
  TOP_STRENGTHS_MAX,
  GROWTH_AREA_OPTIONS,
  GROWTH_AREAS_MAX,
} from '@/lib/constants/onboarding'
import { cn } from '@/lib/utils'
import type { CandidateProfile } from '@prisma/client'

// "Very strong" or "Among the best in my field" on the AI-confidence slider
// (see CORE_SKILL_LABELS below, index 2-3) — the plain-language bar for
// "strong AI skills" that auto-adds an "AI skills" chip to the Skills You
// Have step that follows.
const STRONG_AI_THRESHOLD = 2

const CORE_SKILL_LABELS = [
  'Just getting started',
  'Still building skills',
  'Very strong',
  'Among the best in my field',
] as const

const MANAGEMENT_LABELS = [
  "I haven't had much experience",
  'I prefer to be an individual contributor',
  'I like managing people',
  "It's my favorite thing",
] as const

function snapshotOf(v: {
  topStrengths: string[]
  growthAreas: string[]
  growthAreasElaboration: string
  functionSkillConfidence: number | null
  aiFlexibilityLevel: number | null
  managementSkillConfidence: number | null
}) {
  return JSON.stringify({
    topStrengths: [...v.topStrengths].sort(),
    growthAreas: [...v.growthAreas].sort(),
    growthAreasElaboration: v.growthAreasElaboration,
    functionSkillConfidence: v.functionSkillConfidence,
    aiFlexibilityLevel: v.aiFlexibilityLevel,
    managementSkillConfidence: v.managementSkillConfidence,
  })
}

export function SkillsAssessmentForm({ profile }: { profile: CandidateProfile }) {
  const [state, formAction, pending] = useActionState(updateSkillsAssessment, undefined)
  // Asked from Track Record now (spec §4.2 item 16), not here — this just
  // reads the value Track Record wrote to gate the management-confidence
  // slider below, rather than asking it again.
  const isPeopleManager = profile.isPeopleManager
  const [topStrengths, setTopStrengths] = useState<string[]>(profile.topStrengths)
  const [growthAreas, setGrowthAreas] = useState<string[]>(profile.growthAreas)
  const [growthAreasElaboration, setGrowthAreasElaboration] = useState(profile.growthAreasElaboration ?? '')
  const [functionSkillConfidence, setFunctionSkillConfidence] = useState(profile.functionSkillConfidence)
  const [managementSkillConfidence, setManagementSkillConfidence] = useState(profile.managementSkillConfidence)
  // Tracked live (not just adopted post-save) so the "Skills You Have"
  // AI-skills auto-add below and the dirty-check snapshot both reflect the
  // candidate's current, unsaved slider position, not a stale profile prop.
  const [aiFlexibilityLevel, setAiFlexibilityLevel] = useState(profile.aiFlexibilityLevel)

  const functionLabel = profile.resumeLatestJobTitle ?? profile.primaryFunction

  // "Saved" stays gray until the candidate actually changes an answer, not
  // just for a fixed 2s window (see SubmitButton's controlled `saved` prop).
  const initialSnapshot = snapshotOf({
    topStrengths: profile.topStrengths,
    growthAreas: profile.growthAreas,
    growthAreasElaboration: profile.growthAreasElaboration ?? '',
    functionSkillConfidence: profile.functionSkillConfidence,
    aiFlexibilityLevel: profile.aiFlexibilityLevel,
    managementSkillConfidence: profile.managementSkillConfidence,
  })
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(initialSnapshot)
  const [hasSavedBefore, setHasSavedBefore] = useState(!!profile.skillsAssessmentCompletedAt)
  // Captured in the form's submit handler (an event, not render) so the
  // success effect below can adopt exactly what was submitted, without
  // reading a ref during render.
  const pendingSnapshotRef = useRef<string | null>(null)
  const [showUnlockDialog, setShowUnlockDialog] = useState(false)

  const currentSnapshot = snapshotOf({
    topStrengths,
    growthAreas,
    growthAreasElaboration,
    functionSkillConfidence,
    aiFlexibilityLevel,
    managementSkillConfidence,
  })

  useEffect(() => {
    // One-time adoption of the server action's result, not a derived-render
    // loop — only ever fires right after a real form submission (state
    // transitions from undefined), same pattern as ConfidenceSlider's
    // suggestedValue effect.
    if (state?.success && pendingSnapshotRef.current !== null) {
      setHasSavedBefore(true)
      setLastSavedSnapshot(pendingSnapshotRef.current)
      if (state.firstTimeCompletion) {
        setShowUnlockDialog(true)
      }
    }
  }, [state])

  const isDirty = currentSnapshot !== lastSavedSnapshot

  return (
    <div className="space-y-8">
      <form
        action={(formData) => {
          pendingSnapshotRef.current = currentSnapshot
          formAction(formData)
        }}
        className={cn('space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}
      >
        <p className="text-sm font-medium text-muted-foreground">1. Your skills snapshot</p>

        <div className="space-y-2">
          <Label>
            Every great candidate is exceptional at a few things rather than good at everything.
            Select up to {TOP_STRENGTHS_MAX} strengths that best describe where you truly stand out.
          </Label>
          <MultiChoiceButtons
            name="topStrengths"
            options={TOP_STRENGTH_OPTIONS}
            value={topStrengths}
            onChange={setTopStrengths}
            columns={2}
            max={TOP_STRENGTHS_MAX}
          />
        </div>

        <div id="growth-areas" className="scroll-mt-4 space-y-2">
          <Label>
            Everyone has room to grow, too. Select up to {GROWTH_AREAS_MAX} areas you&apos;re actively working on.
          </Label>
          <MultiChoiceButtons
            name="growthAreas"
            options={GROWTH_AREA_OPTIONS}
            value={growthAreas}
            onChange={setGrowthAreas}
            columns={2}
            max={GROWTH_AREAS_MAX}
          />
          <Textarea
            name="growthAreasElaboration"
            value={growthAreasElaboration}
            onChange={(e) => setGrowthAreasElaboration(e.target.value)}
            placeholder="In your own words (optional) — this helps your Dossier's Self-Awareness section sound like you, not a checklist."
            rows={3}
          />
        </div>

        <ConfidenceSlider
          name="functionSkillConfidence"
          label={
            functionLabel
              ? `How confident are you in your core job function (as a ${functionLabel})?`
              : 'How confident are you in your core job function skills?'
          }
          defaultValue={profile.functionSkillConfidence}
          labels={CORE_SKILL_LABELS}
          onChange={setFunctionSkillConfidence}
        />

        <ConfidenceSlider
          name="aiFlexibilityLevel"
          label="How confident are you in your AI skills?"
          defaultValue={profile.aiFlexibilityLevel}
          labels={CORE_SKILL_LABELS}
          onChange={setAiFlexibilityLevel}
        />

        {isPeopleManager && (
          <ConfidenceSlider
            name="managementSkillConfidence"
            label="How confident are you in your management skills?"
            defaultValue={profile.managementSkillConfidence}
            labels={MANAGEMENT_LABELS}
            onChange={setManagementSkillConfidence}
          />
        )}

        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

        <SubmitButton pendingLabel="Saving…" saved={hasSavedBefore && !isDirty}>
          Save
        </SubmitButton>
      </form>

      <div className="border-t border-border pt-6">
        <SkillsHaveForm
          resumeKeywords={profile.resumeKeywords}
          initialConfirmed={profile.confirmedSkillsHave}
          strongAiSkills={aiFlexibilityLevel !== null && aiFlexibilityLevel >= STRONG_AI_THRESHOLD}
        />
      </div>

      <div className="border-t border-border pt-6">
        <SkillsNeedSection initialSkills={profile.skillsToBuild} targetRole={profile.targetRoleType} />
      </div>

      <SkillsUnlockDialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog} />
    </div>
  )
}
