'use client'

import { useActionState, useState } from 'react'
import type {
  CandidateProfile,
  ContentVenue,
  NetworkComfortLevel,
  NetworkingAnxiety,
  PublicDisclosureComfort,
  ReferralRecency,
} from '@prisma/client'
import { updateMarketingAndNetworkingWillingness } from '@/app/dashboard/search-strategy/actions'
import { useAdvanceSearchStrategyPageOnSave } from '@/components/dashboard/SearchStrategyWizard'
import { SubmitButton } from '@/components/ui/submit-button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { FourStopSlider } from '@/components/onboarding/FourStopSlider'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { MultiChoiceButtons } from '@/components/onboarding/MultiChoiceButtons'
import { COMFORT_LEVEL_CHOICES, CONTENT_VENUE_OPTIONS } from '@/lib/constants/content-venues'
import {
  PUBLIC_DISCLOSURE_COMFORT_OPTIONS,
  REFERRAL_RECENCY_OPTIONS,
  NETWORKING_OUTREACH_SUGGESTED_TARGET,
} from '@/lib/constants/onboarding'
import { cn } from '@/lib/utils'

const OPENNESS_CHOICES = [
  { value: 10, label: 'Not at all — I want this kept quiet' },
  { value: 40, label: "A little uneasy, but I'll try" },
  { value: 70, label: 'Fairly comfortable' },
  { value: 100, label: "I'm openly telling my network" },
] as const

const USAGE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'rarely', label: 'Rarely' },
  { value: 'never', label: 'Never' },
] as const

const NETWORK_COMFORT_OPTIONS: { value: NetworkComfortLevel; label: string }[] = [
  { value: 'VERY_COMFORTABLE', label: 'Very comfortable' },
  { value: 'SOMEWHAT_COMFORTABLE', label: 'Somewhat comfortable' },
  { value: 'NOT_VERY_COMFORTABLE', label: 'Not very comfortable' },
  { value: 'RATHER_NOT', label: "I'd rather not" },
]

const NETWORKING_CONCERN_OPTIONS: { value: NetworkingAnxiety; label: string }[] = [
  { value: 'SEEM_DESPERATE', label: "I don't want to seem desperate" },
  { value: 'BURDEN_PEOPLE', label: "I don't want to burden people" },
  { value: 'NOT_SURE_WHAT_TO_SAY', label: "I'm not sure what to say" },
  { value: 'NETWORK_NOT_STRONG', label: "My network isn't strong enough" },
  { value: 'DONT_LIKE_ASKING_FOR_HELP', label: "I don't like asking for help" },
  { value: 'ALREADY_USED_UP_NETWORK', label: "I've already used up my network" },
  { value: 'OTHER', label: 'Something else' },
]

// Marketing Plan Willingness and Networking Willingness share one wizard
// page (see search-strategy/page.tsx) — one form, one save action, one
// Save button, even though each question set still unlocks its own
// destination (My Marketing Plan/LinkedIn, My Network) independently the
// moment IT'S answered — see updateMarketingAndNetworkingWillingness's own
// comment for why that still works with a single combined submit.
export function MarketingNetworkingForm({ profile }: { profile: CandidateProfile }) {
  const [state, formAction, pending] = useActionState(updateMarketingAndNetworkingWillingness, undefined)
  useAdvanceSearchStrategyPageOnSave(pending, !!state?.error)

  const [publicDisclosureComfort, setPublicDisclosureComfort] = useState<PublicDisclosureComfort | null>(
    profile.publicDisclosureComfort
  )
  const [contentComfortLevel, setContentComfortLevel] = useState<number | null>(profile.contentComfortLevel)
  const [usageFrequency, setUsageFrequency] = useState<string | null>(profile.linkedinUsageFrequency)
  const [profileUpToDate, setProfileUpToDate] = useState<string | null>(
    profile.linkedinProfileUpToDate === null ? null : profile.linkedinProfileUpToDate ? 'yes' : 'no'
  )
  const [networkComfortLevel, setNetworkComfortLevel] = useState<NetworkComfortLevel | null>(
    profile.networkComfortLevel
  )
  const [networkingConcerns, setNetworkingConcerns] = useState<NetworkingAnxiety[]>(profile.networkingConcerns)
  const [hasBeenReferredBefore, setHasBeenReferredBefore] = useState(profile.hasBeenReferredBefore)
  const [referralRecency, setReferralRecency] = useState<ReferralRecency | null>(profile.referralRecency)

  return (
    <form action={formAction} className={cn('space-y-8', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <div className="space-y-6">
        <h3 className="text-sm font-semibold text-foreground">Marketing Plan Willingness</h3>

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
          <Label>What kind of thought leadership have you done, or would you try?</Label>
          <div className="flex flex-wrap gap-4">
            {CONTENT_VENUE_OPTIONS.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <Checkbox
                  id={`venue-${opt.value}`}
                  name="contentVenues"
                  value={opt.value}
                  defaultChecked={profile.contentVenues.includes(opt.value as ContentVenue)}
                />
                <Label htmlFor={`venue-${opt.value}`} className="font-normal">
                  {opt.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Do you like doing these thought leadership pieces?</Label>
          <input type="hidden" name="contentComfortLevel" value={contentComfortLevel ?? ''} />
          <div className="flex flex-wrap gap-2">
            {COMFORT_LEVEL_CHOICES.map((choice) => (
              <button
                key={choice.value}
                type="button"
                aria-pressed={contentComfortLevel === choice.value}
                onClick={() => setContentComfortLevel(choice.value)}
                className={cn(
                  'rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-colors',
                  contentComfortLevel === choice.value
                    ? 'border-brand bg-brand/5 text-brand'
                    : 'border-border bg-white text-foreground hover:border-brand/40'
                )}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>How do you feel about being open about your job search on LinkedIn?</Label>
          <FourStopSlider
            name="linkedinOpennessComfort"
            choices={OPENNESS_CHOICES}
            defaultValue={profile.linkedinOpennessComfort}
          />
        </div>

        <div className="space-y-2">
          <Label>How much do you use LinkedIn?</Label>
          <input type="hidden" name="linkedinUsageFrequency" value={usageFrequency ?? ''} />
          <div className="grid grid-cols-4 gap-1.5">
            {USAGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setUsageFrequency(opt.value)}
                aria-pressed={usageFrequency === opt.value}
                className={cn(
                  'rounded-lg border-2 p-2 text-center text-sm font-medium transition-colors',
                  usageFrequency === opt.value
                    ? 'border-brand bg-brand/5 text-brand'
                    : 'border-border bg-white text-foreground hover:border-brand/40'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Is your LinkedIn profile up to date?</Label>
          <input type="hidden" name="linkedinProfileUpToDate" value={profileUpToDate ?? ''} />
          <div className="grid grid-cols-2 gap-1.5">
            {(['yes', 'no'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setProfileUpToDate(v)}
                aria-pressed={profileUpToDate === v}
                className={cn(
                  'rounded-lg border-2 p-2 text-center text-sm font-medium capitalize transition-colors',
                  profileUpToDate === v
                    ? 'border-brand bg-brand/5 text-brand'
                    : 'border-border bg-white text-foreground hover:border-brand/40'
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6 border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-foreground">Networking Willingness</h3>

        <div className="space-y-2">
          <Label>How comfortable do you feel letting your network know you&apos;re looking for a role?</Label>
          <ChoiceButtons
            name="networkComfortLevel"
            options={NETWORK_COMFORT_OPTIONS}
            value={networkComfortLevel}
            onChange={setNetworkComfortLevel}
            columns={4}
            responsive
          />
        </div>

        <div className="space-y-2">
          <Label>What concerns do you have about reaching out to your network?</Label>
          <p className="text-xs text-muted-foreground">
            Most job searches are won or lost on this one thing — naming the real hesitation is the
            first step past it, and it shapes the outreach scripts we give you.
          </p>
          <MultiChoiceButtons
            name="networkingConcerns"
            options={NETWORKING_CONCERN_OPTIONS}
            value={networkingConcerns}
            onChange={setNetworkingConcerns}
            columns={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="networkingOutreachTargetPerWeek">
            New networking outreach messages per week you&apos;re aiming for{' '}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <p className="text-xs text-muted-foreground">
            We recommend {NETWORKING_OUTREACH_SUGGESTED_TARGET}/week as a baseline.
          </p>
          <Input
            id="networkingOutreachTargetPerWeek"
            name="networkingOutreachTargetPerWeek"
            type="number"
            min={0}
            defaultValue={profile.networkingOutreachTargetPerWeek ?? NETWORKING_OUTREACH_SUGGESTED_TARGET}
            className="w-32"
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
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
    </form>
  )
}
