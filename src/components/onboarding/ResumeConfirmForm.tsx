'use client'

import { useActionState } from 'react'
import type { CandidateProfile } from '@prisma/client'
import { updateResumeConfirm } from '@/app/onboarding/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TagInput } from '@/components/onboarding/TagInput'
import { HIGHEST_LEVEL_OPTIONS, PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'

export function ResumeConfirmForm({ profile }: { profile: CandidateProfile }) {
  const [state, formAction, pending] = useActionState(updateResumeConfirm, undefined)

  return (
    <form
      action={formAction}
      className={`w-full max-w-xl space-y-5 text-left ${pending ? 'cursor-progress [&_*]:cursor-progress' : ''}`}
    >
      <div className="space-y-2">
        <Label htmlFor="highestLevelReached">The highest level you&apos;ve reached</Label>
        <Select name="highestLevelReached" defaultValue={profile.highestLevelReached ?? undefined}>
          <SelectTrigger id="highestLevelReached" className="w-full">
            <SelectValue placeholder="Select one" />
          </SelectTrigger>
          <SelectContent>
            {HIGHEST_LEVEL_OPTIONS.map((level) => (
              <SelectItem key={level} value={level}>
                {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          placeholder="e.g. VP of Operations"
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
