'use client'

import { useActionState, useState } from 'react'
import type { CandidateProfile, NetworkComfortLevel, NetworkingAnxiety, ReferralRecency } from '@prisma/client'
import { updateNetworkingWillingness } from '@/app/dashboard/search-strategy/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { MultiChoiceButtons } from '@/components/onboarding/MultiChoiceButtons'
import { REFERRAL_RECENCY_OPTIONS, NETWORKING_OUTREACH_SUGGESTED_TARGET } from '@/lib/constants/onboarding'
import { cn } from '@/lib/utils'

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

export function NetworkingWillingnessForm({ profile }: { profile: CandidateProfile }) {
  const [state, formAction, pending] = useActionState(updateNetworkingWillingness, undefined)
  const [networkComfortLevel, setNetworkComfortLevel] = useState<NetworkComfortLevel | null>(
    profile.networkComfortLevel
  )
  const [networkingConcerns, setNetworkingConcerns] = useState<NetworkingAnxiety[]>(profile.networkingConcerns)
  const [hasBeenReferredBefore, setHasBeenReferredBefore] = useState(profile.hasBeenReferredBefore)
  const [referralRecency, setReferralRecency] = useState<ReferralRecency | null>(profile.referralRecency)

  return (
    <form
      action={formAction}
      className={cn('space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
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

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Saving…">Save Networking Willingness</SubmitButton>
    </form>
  )
}
