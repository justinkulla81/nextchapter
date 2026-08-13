'use client'

import { useActionState, useState } from 'react'
import type { CandidateProfile, ContentVenue, PublicDisclosureComfort } from '@prisma/client'
import { updateMarketingPlanWillingness } from '@/app/dashboard/search-strategy/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { FourStopSlider } from '@/components/onboarding/FourStopSlider'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { COMFORT_LEVEL_CHOICES, CONTENT_VENUE_OPTIONS } from '@/lib/constants/content-venues'
import { PUBLIC_DISCLOSURE_COMFORT_OPTIONS } from '@/lib/constants/onboarding'
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

export function MarketingPlanWillingnessForm({ profile }: { profile: CandidateProfile }) {
  const [state, formAction, pending] = useActionState(updateMarketingPlanWillingness, undefined)
  const [publicDisclosureComfort, setPublicDisclosureComfort] = useState<PublicDisclosureComfort | null>(
    profile.publicDisclosureComfort
  )
  const [contentComfortLevel, setContentComfortLevel] = useState<number | null>(profile.contentComfortLevel)
  const [usageFrequency, setUsageFrequency] = useState<string | null>(profile.linkedinUsageFrequency)
  const [profileUpToDate, setProfileUpToDate] = useState<string | null>(
    profile.linkedinProfileUpToDate === null ? null : profile.linkedinProfileUpToDate ? 'yes' : 'no'
  )

  return (
    <form
      action={formAction}
      className={cn('space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
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

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Saving…">Save Marketing Plan Willingness</SubmitButton>
    </form>
  )
}
