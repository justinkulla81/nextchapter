'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
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
import { TradeoffRanking } from '@/components/onboarding/TradeoffRanking'
import {
  COMPANY_SIZE_OPTIONS,
  COMPANY_STAGE_OPTIONS,
  PRIMARY_FUNCTION_OPTIONS,
  LOCATION_PREFERENCE_OPTIONS,
  GAP_DURATION_LABELS,
  HIGHEST_LEVEL_OPTIONS,
} from '@/lib/constants/onboarding'
import { cn } from '@/lib/utils'
import type { CandidateProfile } from '@prisma/client'

export function SearchStrategyForm({
  profile,
  inferredIndustries,
  inferredFunction,
  completedReferencesCount,
}: {
  profile: CandidateProfile
  inferredIndustries: string[]
  inferredFunction: string | null
  completedReferencesCount?: number
}) {
  const [state, formAction, pending] = useActionState(updateSearchStrategy, undefined)
  const [willingToStartLower, setWillingToStartLower] = useState(profile.willingToStartLower)
  const [isTargetFlexible, setIsTargetFlexible] = useState(profile.targetRoleType === 'Flexible')
  const [targetRoleType, setTargetRoleType] = useState(
    profile.targetRoleType && profile.targetRoleType !== 'Flexible'
      ? profile.targetRoleType
      : profile.resumeLatestJobTitle ?? ''
  )
  const [remotePreference, setRemotePreference] = useState(profile.remotePreference ?? '')
  const [isPivoting, setIsPivoting] = useState(profile.isPivoting)
  const [openToRelocation, setOpenToRelocation] = useState(profile.openToRelocation)

  return (
    <form
      action={formAction}
      className={cn('space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-2">
        <Label htmlFor="gapDuration">How long have you been searching?</Label>
        <p className="text-xs text-muted-foreground">
          Keep this current as your search goes on — it&apos;s a real input to how your Market
          Reality grade reads a longer search.
        </p>
        <Select name="gapDuration" defaultValue={profile.gapDuration ?? 'none'}>
          <SelectTrigger id="gapDuration" className="w-full scroll-mt-4">
            <SelectValue placeholder="Select one">
              {(value: string | null) =>
                value && value !== 'none'
                  ? GAP_DURATION_LABELS[value as keyof typeof GAP_DURATION_LABELS]
                  : 'Not set'
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Not set</SelectItem>
            {Object.entries(GAP_DURATION_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <div id="targetIndustries" className="scroll-mt-4">
          <TagInput
            name="targetIndustries"
            defaultValue={profile.targetIndustries.length > 0 ? profile.targetIndustries : inferredIndustries}
            placeholder="e.g. Healthcare, Fintech"
            capitalizeFirstLetter
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="primaryFunction">Your primary job function</Label>
        <Select name="primaryFunction" defaultValue={profile.primaryFunction ?? undefined}>
          <SelectTrigger id="primaryFunction" className="w-full scroll-mt-4">
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
        <Label htmlFor="secondaryFunction">Add a second job function</Label>
        <p className="text-xs text-muted-foreground">
          Only set this if your most recent role(s) are in a different function than the bulk of
          your career — we&apos;ll match jobs against both. Leave as &quot;None&quot; otherwise.
        </p>
        <Select name="secondaryFunction" defaultValue={profile.secondaryFunction ?? 'none'}>
          <SelectTrigger id="secondaryFunction" className="w-full">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {PRIMARY_FUNCTION_OPTIONS.map((fn) => (
              <SelectItem key={fn} value={fn}>
                {fn}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="highestLevelReached">Seniority — highest level reached</Label>
        <p className="text-xs text-muted-foreground">Drives how jobs are matched to you.</p>
        <Select name="highestLevelReached" defaultValue={profile.highestLevelReached ?? 'none'}>
          <SelectTrigger id="highestLevelReached" className="w-full scroll-mt-4">
            <SelectValue placeholder="Select one">
              {(value: string | null) => (value && value !== 'none' ? value : 'Not set')}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Not set</SelectItem>
            {HIGHEST_LEVEL_OPTIONS.map((level) => (
              <SelectItem key={level} value={level}>
                {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="targetRoleType">Target role</Label>
        {/* Disabled inputs aren't included in FormData, so the real
            submitted value lives in this hidden input instead. */}
        <input type="hidden" name="targetRoleType" value={isTargetFlexible ? 'Flexible' : targetRoleType} />
        <Input
          id="targetRoleType"
          className="scroll-mt-4"
          value={isTargetFlexible ? 'Flexible' : targetRoleType}
          onChange={(e) => setTargetRoleType(e.target.value)}
          disabled={isTargetFlexible}
        />
        <div className="flex items-center gap-2">
          <Checkbox
            id="targetRoleFlexible"
            checked={isTargetFlexible}
            onCheckedChange={(checked) => setIsTargetFlexible(checked === true)}
          />
          <Label htmlFor="targetRoleFlexible" className="font-normal text-muted-foreground">
            I&apos;m flexible — open to a range of roles
          </Label>
        </div>
      </div>

      <div className="flex items-start gap-2">
        <Checkbox
          id="isPivoting"
          name="isPivoting"
          value="on"
          checked={isPivoting}
          onCheckedChange={(checked) => setIsPivoting(checked === true)}
        />
        <Label htmlFor="isPivoting" className="font-normal">I&apos;m considering a <em>career pivot</em> to a different role or function, not just changing employers</Label>
      </div>

      {isPivoting && (
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
            The function you want to be doing next — it can differ from your background.
          </p>
        </div>
      )}

      <div className="space-y-2">
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
        <Label htmlFor="remotePreference">Location preference</Label>
        <Select
          name="remotePreference"
          value={remotePreference}
          onValueChange={(value) => setRemotePreference(value ?? '')}
        >
          <SelectTrigger id="remotePreference" className="w-full scroll-mt-4">
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
          defaultValue={profile.applicationVolumeGoal ?? 15}
          className="w-32"
        />
      </div>

      <div className="space-y-1 rounded-lg border border-border bg-muted/40 p-3">
        <Label className="text-sm font-semibold">References target</Label>
        <p className="text-sm text-muted-foreground">
          3 completed references is the real minimum, 5 is on target, and 7 means you&apos;re
          outperforming — it&apos;s difficult to unlock an A grade with fewer than 5.
          {completedReferencesCount !== undefined && (
            <>
              {' '}
              You have{' '}
              <span className="font-medium text-foreground">
                {completedReferencesCount} of 5
              </span>{' '}
              so far.
            </>
          )}
        </p>
        <Link href="/dashboard/references" className="text-sm text-primary underline underline-offset-4">
          Manage my references →
        </Link>
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
        <Label className="text-sm font-semibold">Flexibility</Label>
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
        <div className="flex items-start gap-2">
          <Checkbox
            id="openToRelocation"
            name="openToRelocation"
            value="on"
            checked={openToRelocation}
            onCheckedChange={(checked) => setOpenToRelocation(checked === true)}
          />
          <Label htmlFor="openToRelocation" className="font-normal">
            I&apos;m open to relocating for the right role
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

      <SubmitButton pendingLabel="Saving…">Save Search Strategy</SubmitButton>
    </form>
  )
}
