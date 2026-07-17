'use client'

import { useActionState, useState } from 'react'
import { updateSearchStrategy } from '@/app/dashboard/search-strategy/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TagInput } from '@/components/onboarding/TagInput'
import {
  COMPANY_SIZE_OPTIONS,
  COMPANY_STAGE_OPTIONS,
  PRIMARY_FUNCTION_OPTIONS,
} from '@/lib/constants/onboarding'
import { cn } from '@/lib/utils'
import type { CandidateProfile } from '@prisma/client'

export function SearchStrategyForm({
  profile,
  showSkillsNeeded,
}: {
  profile: CandidateProfile
  showSkillsNeeded: boolean
}) {
  const [state, formAction, pending] = useActionState(updateSearchStrategy, undefined)
  const [willingToStartLower, setWillingToStartLower] = useState(profile.willingToStartLower)

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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="targetCompanySize">Target company size</Label>
          <Select name="targetCompanySize" defaultValue={profile.targetCompanySize ?? 'Any'}>
            <SelectTrigger id="targetCompanySize" className="w-full">
              <SelectValue placeholder="Select one">
                {(value: string | null) =>
                  value ? (value === 'Any' ? 'Any size' : `${value} employees`) : 'Select one'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {COMPANY_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={size}>
                  {size === 'Any' ? 'Any size' : `${size} employees`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="targetCompanyStage">Target company type</Label>
          <Select name="targetCompanyStage" defaultValue={profile.targetCompanyStage ?? 'any'}>
            <SelectTrigger id="targetCompanyStage" className="w-full">
              <SelectValue placeholder="Select one">
                {(value: string | null) =>
                  COMPANY_STAGE_OPTIONS.find((opt) => opt.value === value)?.label ?? 'Select one'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {COMPANY_STAGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="targetCompMin">What is the minimum comp you are able to take? (optional)</Label>
        <div className="flex items-center gap-2">
          <div className="relative w-36">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <Input
              id="targetCompMin"
              name="targetCompMinThousands"
              type="number"
              min={0}
              placeholder="120"
              className="pl-7"
              defaultValue={profile.targetCompMin ? Math.round(profile.targetCompMin / 1000) : undefined}
            />
          </div>
          <span className="text-sm text-muted-foreground">
            ,000 — e.g. enter <span className="font-medium text-foreground">120</span> for $120,000
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox id="compFlexible" name="compFlexible" value="on" defaultChecked={profile.compFlexible} />
          <Label htmlFor="compFlexible" className="font-normal">
            I have flexibility on compensation
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="equityImportant"
            name="equityImportant"
            value="on"
            defaultChecked={profile.equityImportant}
          />
          <Label htmlFor="equityImportant" className="font-normal">
            Equity matters to me
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="willingToStartLower"
            name="willingToStartLower"
            value="on"
            defaultChecked={profile.willingToStartLower}
            onCheckedChange={setWillingToStartLower}
          />
          <Label htmlFor="willingToStartLower" className="font-normal">
            I&apos;m willing to start at a lower level or title
          </Label>
        </div>
        {willingToStartLower && (
          <Textarea
            name="startLowerRationale"
            placeholder="Why? (optional, but helps employers understand the offer)"
            rows={2}
            defaultValue={profile.startLowerRationale ?? ''}
          />
        )}
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

      {showSkillsNeeded && (
        <div className="space-y-2">
          <Label htmlFor="skillsStillNeeded">
            Skills you need to build to get and do your next job{' '}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="skillsStillNeeded"
            name="skillsStillNeeded"
            rows={2}
            defaultValue={profile.skillsStillNeeded ?? ''}
            placeholder="e.g. AI, public speaking, P&L skills, new AI tools for my job function"
          />
        </div>
      )}

      <div className="flex items-start gap-2">
        <Checkbox id="isPivoting" name="isPivoting" defaultChecked={profile.isPivoting} />
        <Label htmlFor="isPivoting" className="font-normal">
          I&apos;m <em>considering</em> pivoting to a different role or function, not just changing employers
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

      <div className="space-y-2">
        <Label htmlFor="dealBreakers">
          Are there any other important considerations for your next job? (optional)
        </Label>
        <Textarea
          id="dealBreakers"
          name="dealBreakers"
          rows={2}
          defaultValue={profile.dealBreakers ?? ''}
        />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton pendingLabel="Saving…">Save Search Strategy</SubmitButton>
    </form>
  )
}
