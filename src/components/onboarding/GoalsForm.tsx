'use client'

import { useActionState, useState } from 'react'
import { updateGoals } from '@/app/onboarding/actions'
import { Button } from '@/components/ui/button'
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
import { TagInput } from './TagInput'
import { TradeoffRanking } from './TradeoffRanking'
import { ChoiceButtons } from './ChoiceButtons'
import {
  COMPANY_SIZE_OPTIONS,
  COMPANY_STAGE_OPTIONS,
  PRIMARY_FUNCTION_OPTIONS,
  LOCATION_PREFERENCE_OPTIONS,
  PUBLIC_DISCLOSURE_COMFORT_OPTIONS,
  REFERRAL_RECENCY_OPTIONS,
} from '@/lib/constants/onboarding'
import { cn } from '@/lib/utils'
import type { CandidateProfile, PublicDisclosureComfort, ReferralRecency } from '@prisma/client'

export function GoalsForm({
  profile,
  inferredIndustries,
  inferredFunction,
}: {
  profile: CandidateProfile
  inferredIndustries: string[]
  inferredFunction: string | null
}) {
  const [state, formAction, pending] = useActionState(updateGoals, undefined)
  const [willingToStartLower, setWillingToStartLower] = useState(profile.willingToStartLower)
  const [openToRelocation, setOpenToRelocation] = useState(profile.openToRelocation)
  const [remotePreference, setRemotePreference] = useState(profile.remotePreference ?? '')
  const [publicDisclosureComfort, setPublicDisclosureComfort] = useState<PublicDisclosureComfort | null>(
    profile.publicDisclosureComfort
  )
  const [hasBeenReferredBefore, setHasBeenReferredBefore] = useState(profile.hasBeenReferredBefore)
  const [referralRecency, setReferralRecency] = useState<ReferralRecency | null>(profile.referralRecency)

  return (
    <form
      action={formAction}
      className={cn('space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      {profile.resumeLatestJobTitle && (
        <p className="text-sm text-muted-foreground">
          Your last title was <span className="font-medium text-foreground">{profile.resumeLatestJobTitle}</span>.
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="targetRoleType">
          What role are you targeting? <span className="font-normal text-muted-foreground">(it&apos;s OK to say &quot;flexible&quot;)</span>
        </Label>
        <Input
          id="targetRoleType"
          name="targetRoleType"
          defaultValue={profile.targetRoleType ?? ''}
        />
      </div>

      <div className="space-y-2">
        {inferredIndustries.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Your past industries included:{' '}
            <span className="font-medium text-foreground">{inferredIndustries.join(', ')}</span>.
            We&apos;ve added these below — remove any that don&apos;t apply, or add more.
          </p>
        )}
        <Label>Target industries</Label>
        <TagInput
          name="targetIndustries"
          defaultValue={profile.targetIndustries.length > 0 ? profile.targetIndustries : inferredIndustries}
          placeholder="e.g. Healthcare, Fintech"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="targetFunction">Target job function</Label>
        <Select name="targetFunction" defaultValue={profile.targetFunction ?? inferredFunction ?? undefined}>
          <SelectTrigger id="targetFunction" className="w-full">
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
        <p className="text-xs text-muted-foreground">
          {inferredFunction
            ? 'Pre-filled based on your background — change it if you’re targeting something different.'
            : 'The function you want to be doing next — it can differ from your background.'}
        </p>
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
        <Label htmlFor="primaryFunction">Your background function</Label>
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
        <p className="text-xs text-muted-foreground">Pre-filled from your resume — correct anything that&apos;s off.</p>
      </div>

      <div className="space-y-2">
        <Label>
          How comfortable are you with being publicly visible as job-searching — things like
          LinkedIn&apos;s &quot;Open to Work&quot; or a public post — separate from telling people you know
          directly?
        </Label>
        <ChoiceButtons
          name="publicDisclosureComfort"
          options={PUBLIC_DISCLOSURE_COMFORT_OPTIONS}
          value={publicDisclosureComfort}
          onChange={setPublicDisclosureComfort}
          columns={2}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="hasBeenReferredBefore"
            name="hasBeenReferredBefore"
            value="on"
            defaultChecked={hasBeenReferredBefore ?? false}
            onCheckedChange={(checked) => setHasBeenReferredBefore(checked === true)}
          />
          <Label htmlFor="hasBeenReferredBefore" className="font-normal">
            Have you networked or been referred into a job before?
          </Label>
        </div>
        {hasBeenReferredBefore && (
          <div className="space-y-2 pl-6">
            <Label>How recently?</Label>
            <ChoiceButtons
              name="referralRecency"
              options={REFERRAL_RECENCY_OPTIONS}
              value={referralRecency}
              onChange={setReferralRecency}
              columns={3}
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="remotePreference">Location preference</Label>
        <Select
          name="remotePreference"
          value={remotePreference}
          onValueChange={(value) => setRemotePreference(value ?? '')}
        >
          <SelectTrigger id="remotePreference" className="w-full">
            <SelectValue placeholder="Select one">
              {(value: string | null) =>
                LOCATION_PREFERENCE_OPTIONS.find((opt) => opt.value === value)?.label ?? 'Select one'
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {LOCATION_PREFERENCE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="compFlexible"
            name="compFlexible"
            value="on"
            defaultChecked={profile.compFlexible}
          />
          <Label htmlFor="compFlexible" className="font-normal">
            I have flexibility on compensation
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
        <div className="flex items-start gap-2">
          <Checkbox id="isPivoting" name="isPivoting" value="on" defaultChecked={profile.isPivoting} />
          <Label htmlFor="isPivoting" className="font-normal">
            I&apos;m <em>considering</em> pivoting to a different role or function, not just changing employers
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="openToRelocation"
            name="openToRelocation"
            value="on"
            checked={openToRelocation}
            onCheckedChange={(checked) => setOpenToRelocation(checked === true)}
          />
          <Label htmlFor="openToRelocation" className="font-normal">
            Open to relocating
          </Label>
        </div>
        {openToRelocation && (
          <Textarea
            name="relocationNotes"
            placeholder="Relocation notes (optional)"
            defaultValue={profile.relocationNotes ?? ''}
            rows={2}
          />
        )}
      </div>

      <div className="space-y-2">
        <Label>
          Rank what matters most to you right now — drag isn&apos;t required, use the arrows.
        </Label>
        <p className="text-sm text-muted-foreground">1 = matters most, 5 = matters least.</p>
        <TradeoffRanking profile={profile} />
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

      <Button type="submit" disabled={pending}>
        {pending ? 'Calculating your score…' : 'See my Market Reality Grade'}
      </Button>
    </form>
  )
}
