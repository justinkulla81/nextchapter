'use client'

import { useActionState, useEffect, useState } from 'react'
import { updateSkillsAssessment } from '@/app/dashboard/skills-assessment/actions'
import { SkillsHaveForm } from '@/components/dashboard/SkillsHaveForm'
import { SkillsNeedSection } from '@/components/dashboard/SkillsNeedSection'
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

export function SkillsAssessmentForm({ profile }: { profile: CandidateProfile }) {
  const [state, formAction, pending] = useActionState(updateSkillsAssessment, undefined)
  // Asked from Track Record now (spec §4.2 item 16), not here — this just
  // reads the value Track Record wrote to gate the management-confidence
  // slider below, rather than asking it again.
  const isPeopleManager = profile.isPeopleManager
  const [topStrengths, setTopStrengths] = useState<string[]>(profile.topStrengths)
  const [growthAreas, setGrowthAreas] = useState<string[]>(profile.growthAreas)

  const functionLabel = profile.resumeLatestJobTitle ?? profile.primaryFunction

  // Skills You Have / Skills You Need used to live as their own
  // always-visible section on the Skills & Behavioral Assessments hub page
  // — moved here, after the questionnaire, so first-time completion reads
  // as one continuous flow: answer, then confirm what you have, then what
  // you need. A candidate who already has a skillsAssessmentCompletedAt
  // (retaking) sees all three sections together immediately, since they've
  // already been through the sequence once. aiFlexibilityLevel is tracked
  // live so the AI-skills auto-add below reflects whatever was just saved
  // in this session, not a stale profile prop.
  const [questionnaireDone, setQuestionnaireDone] = useState(!!profile.skillsAssessmentCompletedAt)
  const [skillsHaveDone, setSkillsHaveDone] = useState(!!profile.skillsHaveConfirmedAt)
  const [aiFlexibilityLevel, setAiFlexibilityLevel] = useState(profile.aiFlexibilityLevel)

  useEffect(() => {
    // One-time adoption of the server action's result, not a derived-render
    // loop — only ever fires right after a real form submission (state
    // transitions from undefined), same pattern as ConfidenceSlider's
    // suggestedValue effect.
    if (state?.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuestionnaireDone(true)
      setAiFlexibilityLevel(state.aiFlexibilityLevel ?? null)
    }
  }, [state])

  return (
    <div className="space-y-8">
      <form
        action={formAction}
        className={cn('space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}
      >
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
            defaultValue={profile.growthAreasElaboration ?? ''}
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
        />

        <ConfidenceSlider
          name="aiFlexibilityLevel"
          label="How confident are you in your AI skills?"
          defaultValue={profile.aiFlexibilityLevel}
          labels={CORE_SKILL_LABELS}
        />

        {isPeopleManager && (
          <ConfidenceSlider
            name="managementSkillConfidence"
            label="How confident are you in your management skills?"
            defaultValue={profile.managementSkillConfidence}
            labels={MANAGEMENT_LABELS}
          />
        )}

        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

        <SubmitButton pendingLabel="Saving…">Save Skills Inventory</SubmitButton>
      </form>

      {questionnaireDone && (
        <div className="border-t border-border pt-6">
          <SkillsHaveForm
            resumeKeywords={profile.resumeKeywords}
            initialConfirmed={profile.confirmedSkillsHave}
            strongAiSkills={aiFlexibilityLevel !== null && aiFlexibilityLevel >= STRONG_AI_THRESHOLD}
            onSaved={() => setSkillsHaveDone(true)}
          />
        </div>
      )}

      {skillsHaveDone && (
        <div className="border-t border-border pt-6">
          <SkillsNeedSection initialSkills={profile.skillsToBuild} targetRole={profile.targetRoleType} />
        </div>
      )}
    </div>
  )
}
