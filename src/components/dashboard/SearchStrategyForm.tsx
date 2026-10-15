'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { updateSearchStrategy } from '@/app/dashboard/search-strategy/actions'
import { useAdvanceSearchStrategyPageOnSave } from '@/components/dashboard/SearchStrategyWizard'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PersonalizationQuestion } from '@/components/ui/personalization-question'
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

// A quiet visual flag next to a Label — not answered yet, in-context, no
// separate legend needed. Only used on the fields search-strategy-checklist.ts
// tracks as real completeness gaps (see FIELDS there) — every other field on
// this form is genuinely optional and shouldn't be flagged.
function UnansweredBadge() {
  return (
    <span className="ml-2 rounded-full bg-warning/10 px-2 py-0.5 align-middle text-[10px] font-medium text-warning">
      Not answered yet
    </span>
  )
}

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
  useAdvanceSearchStrategyPageOnSave(pending, !!state?.error)
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
      <PersonalizationQuestion
        id="gap-duration"
        htmlFor="gapDuration"
        question="How long have you been searching?"
        payoff="Your Market Reality grade reads a longer search fairly. Keep this current as your search goes on."
        badge={!profile.gapDuration && <UnansweredBadge />}
      >
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
      </PersonalizationQuestion>

      <PersonalizationQuestion
        id="target-industries"
        question="Which industries do you want to work in?"
        payoff="Job matches and market data focus on the industries you pick."
        badge={profile.targetIndustries.length === 0 && inferredIndustries.length === 0 && <UnansweredBadge />}
      >
        {inferredIndustries.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Your past industries included:{' '}
            <span className="font-medium text-foreground">{inferredIndustries.join(', ')}</span>.
            We&apos;ve added these below — remove any that don&apos;t apply, or add more.
          </p>
        )}
        <div id="targetIndustries" className="scroll-mt-4">
          <TagInput
            name="targetIndustries"
            defaultValue={profile.targetIndustries.length > 0 ? profile.targetIndustries : inferredIndustries}
            placeholder="e.g. Healthcare, Fintech"
            capitalizeFirstLetter
          />
        </div>
      </PersonalizationQuestion>

      <PersonalizationQuestion
        id="primary-function"
        htmlFor="primaryFunction"
        question="What is your primary job function?"
        payoff="Jobs, pivot paths and skills recommendations start from your function."
        badge={!profile.primaryFunction && <UnansweredBadge />}
      >
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
      </PersonalizationQuestion>

      <PersonalizationQuestion
        id="secondary-function"
        htmlFor="secondaryFunction"
        question="Do your recent roles sit in a second job function?"
        payoff="We match jobs against both functions. Leave as “None” if your career has stayed in one."
        optional
      >
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
      </PersonalizationQuestion>

      <PersonalizationQuestion
        id="highest-level"
        htmlFor="highestLevelReached"
        question="What is the highest level you have reached?"
        payoff="Jobs are matched to a level you could realistically land."
        badge={!profile.highestLevelReached && <UnansweredBadge />}
      >
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
      </PersonalizationQuestion>

      <PersonalizationQuestion
        id="target-role"
        htmlFor="targetRoleType"
        question="What role are you aiming for next?"
        payoff="Job matches and skills recommendations aim at this role."
        badge={!profile.targetRoleType && <UnansweredBadge />}
      >
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
      </PersonalizationQuestion>

      <PersonalizationQuestion
        id="pivoting"
        question="Are you considering a career pivot?"
        payoff="Pivot paths and job matches reach toward the function you want to move into."
        optional
      >
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
            <Label htmlFor="targetFunction">Which function do you want to be doing next?</Label>
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
            <p className="text-xs text-muted-foreground">It can differ from your background.</p>
          </div>
        )}
      </PersonalizationQuestion>

      <PersonalizationQuestion
        id="start-lower"
        question="Would you start at a lower level or title?"
        payoff="You see more openings, and employers see why you would take the step."
        optional
      >
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
      </PersonalizationQuestion>

      <PersonalizationQuestion
        id="company-size"
        htmlFor="targetCompanySize"
        question="What size of company do you want to work for?"
        payoff="Company and job suggestions lean toward the size you prefer."
        optional
      >
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
      </PersonalizationQuestion>

      <PersonalizationQuestion
        id="company-stage"
        htmlFor="targetCompanyStage"
        question="What type of company do you want to work for?"
        payoff="Company and job suggestions lean toward the type you prefer."
        optional
      >
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
      </PersonalizationQuestion>

      <PersonalizationQuestion
        id="location-preference"
        htmlFor="remotePreference"
        question="Where do you want to work?"
        payoff="Job counts and matches reflect remote, hybrid or on-site roles near you."
        badge={!profile.remotePreference && <UnansweredBadge />}
      >
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
      </PersonalizationQuestion>

      <PersonalizationQuestion
        id="application-volume"
        htmlFor="applicationVolumeGoal"
        question="How many applications per week are you aiming for?"
        payoff="Your weekly plan and progress tracking use your own target."
        optional
      >
        <Input
          id="applicationVolumeGoal"
          name="applicationVolumeGoal"
          type="number"
          min={0}
          defaultValue={profile.applicationVolumeGoal ?? 15}
          className="w-32"
        />
      </PersonalizationQuestion>

      <PersonalizationQuestion
        id="follow-up"
        question="Will you follow up on applications you have submitted?"
        payoff="Your coach can plan follow-up notes with you after you apply."
        optional
      >
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            name="willingToFollowUpOnApplications"
            value="on"
            defaultChecked={profile.willingToFollowUpOnApplications ?? undefined}
          />
          <span>
            I&apos;m willing to follow up on applications I&apos;ve submitted (a short note to a
            recruiter or hiring manager a week or two after applying)
          </span>
        </label>
      </PersonalizationQuestion>

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

      <PersonalizationQuestion
        id="comp-minimum"
        htmlFor="targetCompMin"
        question="What is the minimum comp you are able to take?"
        payoff="Pay comparisons and job matches use your real floor."
        optional
      >
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
      </PersonalizationQuestion>

      <PersonalizationQuestion
        id="flexibility"
        question="Where are you flexible?"
        payoff="You see roles that fit your real tradeoffs on pay, equity, relocation, travel and interim work."
        optional
      >
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
            <Checkbox id="travelWillingness" name="travelWillingness" value="on" defaultChecked={profile.travelWillingness} />
            <Label htmlFor="travelWillingness" className="font-normal">
              I&apos;m willing to travel for a role (not the same as relocating)
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
        </div>
      </PersonalizationQuestion>

      <PersonalizationQuestion
        id="tradeoffs"
        question="What matters most to you right now?"
        payoff="Your matches weigh what you rank first. Use the arrows to rank: 1 matters most, 5 matters least."
        optional
      >
        <TradeoffRanking profile={profile} />
      </PersonalizationQuestion>

      <PersonalizationQuestion
        id="deal-breakers"
        htmlFor="dealBreakers"
        question="Is there anything else important for your next job?"
        payoff="Your coach keeps your deal-breakers in mind when suggesting roles."
        optional
      >
        <Textarea
          id="dealBreakers"
          name="dealBreakers"
          rows={2}
          defaultValue={profile.dealBreakers ?? ''}
        />
      </PersonalizationQuestion>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton pendingLabel="Saving…">Save Search Strategy</SubmitButton>
    </form>
  )
}
