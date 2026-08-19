'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { updateSkillsAssessment } from '@/app/dashboard/skills-assessment/actions'
import { SkillsHaveAndNeedForm } from '@/components/dashboard/SkillsHaveAndNeedForm'
import { SkillsUnlockDialog } from '@/components/dashboard/SkillsUnlockDialog'
import { Button } from '@/components/ui/button'
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

type Step = 'skills' | 'have-need' | 'done'

// Two pages, not three separate save-as-you-go forms: "Your Skills" (the
// confidence/strengths questionnaire) then "Skills You Have & Need to
// Build" (one combined step, one "Confirm" — not "Save," since this is the
// end of the flow, not an editable settings form) — matching the
// Market Reality Assessment's own pagination pattern instead of a single
// long scroll of three independently-saved cards. Confirming step 2 shows
// a completion screen offering Learn New Skills or back to the dashboard.
// Each step calls its server action directly inside a transition rather
// than via useActionState+useEffect, so advancing to the next step happens
// right where the action resolves instead of reacting to state changes
// from an effect.
export function SkillsAssessmentForm({ profile }: { profile: CandidateProfile }) {
  // Asked from Track Record now (spec §4.2 item 16), not here — this just
  // reads the value Track Record wrote to gate the management-confidence
  // slider below, rather than asking it again.
  const isPeopleManager = profile.isPeopleManager
  const [topStrengths, setTopStrengths] = useState<string[]>(profile.topStrengths)
  const [growthAreas, setGrowthAreas] = useState<string[]>(profile.growthAreas)
  const [growthAreasElaboration, setGrowthAreasElaboration] = useState(profile.growthAreasElaboration ?? '')
  const [, setFunctionSkillConfidence] = useState(profile.functionSkillConfidence)
  const [, setManagementSkillConfidence] = useState(profile.managementSkillConfidence)
  // Tracked live (not just adopted post-save) so the Skills You Have step's
  // AI-skills auto-add reflects the candidate's current, unsaved slider
  // position, not a stale profile prop.
  const [aiFlexibilityLevel, setAiFlexibilityLevel] = useState(profile.aiFlexibilityLevel)

  const functionLabel = profile.resumeLatestJobTitle ?? profile.primaryFunction

  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showUnlockDialog, setShowUnlockDialog] = useState(false)
  const [step, setStep] = useState<Step>('skills')

  function handleContinue(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await updateSkillsAssessment(undefined, formData)
      if (result?.error) {
        setError(result.error)
        return
      }
      if (result?.firstTimeCompletion) {
        setShowUnlockDialog(true)
      }
      setStep('have-need')
    })
  }

  if (step === 'done') {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden />
        <div>
          <p className="font-medium text-foreground">Skills Inventory saved</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This now personalizes your Job Recommendations, Skills Recommendations, and Market
            Reality Report.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button nativeButton={false} render={<Link href="/dashboard/learning" />}>
            Learn New Skills
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/dashboard" />}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'have-need') {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setStep('skills')}
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Back to Your Skills
        </button>
        <SkillsHaveAndNeedForm
          resumeKeywords={profile.resumeKeywords}
          initialSkillsHave={profile.confirmedSkillsHave}
          strongAiSkills={aiFlexibilityLevel !== null && aiFlexibilityLevel >= STRONG_AI_THRESHOLD}
          initialSkillsNeed={profile.skillsToBuild}
          targetRole={profile.targetRoleType}
          onConfirmed={() => setStep('done')}
        />
        <SkillsUnlockDialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog} />
      </div>
    )
  }

  return (
    <form
      action={handleContinue}
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

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Continue'}
      </Button>
    </form>
  )
}
