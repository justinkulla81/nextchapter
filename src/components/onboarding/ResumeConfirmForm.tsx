'use client'

import { useActionState, useState } from 'react'
import type { CandidateProfile } from '@prisma/client'
import { updateResumeConfirm } from '@/app/onboarding/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TagInput } from '@/components/onboarding/TagInput'
import { HIGHEST_LEVEL_OPTIONS, PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'
import { CAREER_STAGE_CHOICES, choiceForMember, targetRolePlaceholder, type CareerStageChoice } from '@/lib/early-career/audience'
import { DEGREE_CHOICES } from '@/lib/early-career/education-form'
import type { EducationSummary } from '@/lib/early-career/data'
import { cn } from '@/lib/utils'

export function ResumeConfirmForm({ profile, education = null }: { profile: CandidateProfile; education?: EducationSummary | null }) {
  const [state, formAction, pending] = useActionState(updateResumeConfirm, undefined)
  // "Where are you in your career?" Three adjacent buttons; the two early
  // stages also ask for school, major and graduation year.
  const [stage, setStage] = useState<CareerStageChoice | null>(choiceForMember(profile))
  const early = stage === 'new_grad' || stage === 'early'
  const audience = stage === 'new_grad' ? 'NEW_GRAD' : stage === 'early' ? 'EARLY_CAREER' : null
  const initialDegree = education?.degree && (DEGREE_CHOICES as readonly string[]).includes(education.degree) ? education.degree : education ? 'Other' : "Bachelor's"
  const [degree, setDegree] = useState<string>(initialDegree)

  return (
    <form
      action={formAction}
      className={`w-full max-w-xl space-y-5 text-left ${pending ? 'cursor-progress [&_*]:cursor-progress' : ''}`}
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Where are you in your career?</legend>
        <input type="hidden" name="careerStage" value={stage ?? ''} />
        <div className="grid gap-2 sm:grid-cols-3">
          {CAREER_STAGE_CHOICES.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={stage === c.key}
              onClick={() => setStage(c.key)}
              className={cn(
                'rounded-lg border-2 px-3 py-2 text-left transition-colors',
                stage === c.key ? 'border-brand bg-brand/5' : 'border-border bg-white hover:border-brand/40'
              )}
            >
              <span className={cn('block text-sm font-semibold', stage === c.key ? 'text-brand' : 'text-navy')}>{c.label}</span>
              <span className="block text-xs text-muted-foreground">{c.detail}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {early && (
        <div className="space-y-4 rounded-lg border border-border bg-off-white p-4">
          <input type="hidden" name="degree" value={degree} />
          <div className="space-y-2">
            <Label htmlFor="schoolName">Your school</Label>
            <Input id="schoolName" name="schoolName" defaultValue={education?.schoolName ?? ''} placeholder="e.g. Ohio State University" />
          </div>
          <div className="space-y-2">
            <span className="text-sm font-medium">Degree</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Degree">
              {DEGREE_CHOICES.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={degree === d}
                  onClick={() => setDegree(d)}
                  className={cn(
                    'rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-colors',
                    degree === d ? 'border-brand bg-brand/5 text-brand' : 'border-border bg-white hover:border-brand/40'
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <div className="space-y-2">
              <Label htmlFor="fieldOfStudy">Major</Label>
              <Input id="fieldOfStudy" name="fieldOfStudy" defaultValue={education?.fieldOfStudy ?? ''} placeholder="e.g. Economics" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="graduationYear">Graduation year</Label>
              <Input id="graduationYear" name="graduationYear" type="number" inputMode="numeric" defaultValue={education?.graduationYear ?? ''} placeholder="e.g. 2026" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Optional. It shows you entry-level roles for your major and connects you with your alumni.</p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="highestLevelReached">The highest level you&apos;ve reached</Label>
        <Select name="highestLevelReached" defaultValue={profile.highestLevelReached ?? (early ? 'IC' : undefined)} key={early ? 'early' : 'other'}>
          <SelectTrigger id="highestLevelReached" className="w-full">
            <SelectValue placeholder="Select one" />
          </SelectTrigger>
          <SelectContent>
            {HIGHEST_LEVEL_OPTIONS.map((level) => (
              <SelectItem key={level} value={level}>
                {level === 'IC' ? 'Individual contributor (IC)' : level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="yearsExperience">Years of professional experience</Label>
        <Input
          id="yearsExperience"
          name="yearsExperience"
          type="number"
          inputMode="numeric"
          min={0}
          max={60}
          defaultValue={profile.yearsExperience ?? ''}
          placeholder="e.g. 3"
          className="w-32"
        />
        <p className="text-xs text-muted-foreground">
          Optional. Leave it blank and we&apos;ll go by the stage you picked above.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="primaryFunction">Your primary job function</Label>
        <Select name="primaryFunction" defaultValue={profile.primaryFunction ?? undefined}>
          <SelectTrigger id="primaryFunction" className="w-full">
            <SelectValue placeholder="Select one" />
          </SelectTrigger>
          <SelectContent>
            {PRIMARY_FUNCTION_OPTIONS.map((fn) => (
              <SelectItem key={fn} value={fn}>
                {fn}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="targetRoleType">What role are you targeting next?</Label>
        <Input
          id="targetRoleType"
          name="targetRoleType"
          defaultValue={profile.targetRoleType ?? profile.resumeLatestJobTitle ?? ''}
          placeholder={targetRolePlaceholder(audience)}
        />
      </div>

      <div className="space-y-2">
        <Label>Your industries</Label>
        <TagInput
          name="industries"
          defaultValue={
            profile.industryContext
              ? [
                  profile.industryContext,
                  ...profile.targetIndustries.filter((i) => i !== profile.industryContext),
                ]
              : profile.targetIndustries
          }
          placeholder="e.g. Healthcare, Fintech"
          capitalizeFirstLetter
        />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton className="w-full">Looks right — continue</SubmitButton>
    </form>
  )
}
