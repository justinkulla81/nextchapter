'use client'

import { useActionState } from 'react'
import { updateSearchStrategy } from '@/app/dashboard/search-strategy/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { TagInput } from '@/components/onboarding/TagInput'
import { cn } from '@/lib/utils'
import type { CandidateProfile } from '@prisma/client'

export function SearchStrategyForm({ profile }: { profile: CandidateProfile }) {
  const [state, formAction, pending] = useActionState(updateSearchStrategy, undefined)

  return (
    <form
      action={formAction}
      className={cn('space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-2">
        <Label htmlFor="targetRoleType">Target role</Label>
        <Input id="targetRoleType" name="targetRoleType" defaultValue={profile.targetRoleType ?? ''} />
      </div>

      <div className="space-y-2">
        <Label>Target industries</Label>
        <TagInput
          name="targetIndustries"
          defaultValue={profile.targetIndustries}
          placeholder="e.g. Healthcare, Fintech"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="applicationVolumeGoal">
          Applications per week you&apos;re aiming for{' '}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="applicationVolumeGoal"
          name="applicationVolumeGoal"
          type="number"
          min={0}
          defaultValue={profile.applicationVolumeGoal ?? ''}
          className="w-32"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="skillsStillNeeded">
          Skills you know you still need{' '}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="skillsStillNeeded"
          name="skillsStillNeeded"
          rows={2}
          defaultValue={profile.skillsStillNeeded ?? ''}
          placeholder="e.g. SQL, a specific certification, public speaking"
        />
      </div>

      <div className="flex items-start gap-2">
        <Checkbox id="isPivoting" name="isPivoting" defaultChecked={profile.isPivoting} />
        <Label htmlFor="isPivoting" className="font-normal">
          I&apos;m pivoting to a different role or function, not just changing employers
        </Label>
      </div>

      <div className="flex items-start gap-2">
        <Checkbox
          id="openToRelocation"
          name="openToRelocation"
          defaultChecked={profile.openToRelocation}
        />
        <Label htmlFor="openToRelocation" className="font-normal">
          I&apos;m open to relocating for the right role
        </Label>
      </div>

      <div className="flex items-start gap-2">
        <Checkbox
          id="interimConsultingInterest"
          name="interimConsultingInterest"
          defaultChecked={profile.interimConsultingInterest}
        />
        <Label htmlFor="interimConsultingInterest" className="font-normal">
          I&apos;d consider fractional or interim consulting work while I search
        </Label>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton pendingLabel="Saving…">Save Search Strategy</SubmitButton>
    </form>
  )
}
