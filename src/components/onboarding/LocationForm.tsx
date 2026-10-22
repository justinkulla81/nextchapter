'use client'

import { APPLY_TIMING, LAID_OFF_TIMING, MOVE_DRIVERS, effectiveJourney, getJourney, type ApplyTiming, type LaidOffTiming, type MoveDriver } from '@/lib/journey/journey'
import { useActionState, useState } from 'react'
import type { CandidateProfile, CoachingStylePreference, GapDurationBucket, NetworkComfortLevel } from '@prisma/client'
import { updateLocationAndSearchStatus } from '@/app/onboarding/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { NativeSelect } from '@/components/ui/native-select'
import { PAY_FLOOR_BANDS, bandForFloor } from '@/lib/onboarding/pay-floor'
import { SEARCH_STALL_OPTIONS } from '@/lib/onboarding/search-stall'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { INTENSITY_OPTIONS } from '@/lib/journey/intensity'
import { CultureFitFields } from '@/components/onboarding/CultureFitFields'
import { parseCultureFit } from '@/lib/culture/culture-fit'
import { LOCATION_PREFERENCE_OPTIONS, GAP_DURATION_LABELS, AI_JOB_LOSS_OPTIONS, COACHING_STYLE_OPTIONS } from '@/lib/constants/onboarding'

const GAP_DURATION_OPTIONS = (Object.entries(GAP_DURATION_LABELS) as [GapDurationBucket, string][]).map(
  ([value, label]) => ({ value, label })
)

const NETWORK_COMFORT_OPTIONS: { value: NetworkComfortLevel; label: string }[] = [
  { value: 'VERY_COMFORTABLE', label: 'Very comfortable' },
  { value: 'SOMEWHAT_COMFORTABLE', label: 'Somewhat comfortable' },
  { value: 'NOT_VERY_COMFORTABLE', label: 'Not very comfortable' },
  { value: 'RATHER_NOT', label: "I'd rather not" },
]

export function LocationForm({ profile }: { profile: CandidateProfile }) {
  const [state, formAction, pending] = useActionState(updateLocationAndSearchStatus, undefined)
  const [remotePreference, setRemotePreference] = useState<string | null>(profile.remotePreference)
  const [openToRelocation, setOpenToRelocation] = useState(profile.openToRelocation)
  const [travelWillingness, setTravelWillingness] = useState(profile.travelWillingness)
  const [justStartedSearch, setJustStartedSearch] = useState(profile.justStartedSearch)
  const [gapDuration, setGapDuration] = useState<GapDurationBucket | null>(profile.gapDuration)
  // Employed journeys are asked when they want to start applying, not how
  // long they've been out of work (src/lib/journey/journey.ts).
  const journey = effectiveJourney(profile)
  const employed = journey ? getJourney(journey).employed : false
  const searching = journey ? getJourney(journey).searching : true
  const [applyTiming, setApplyTiming] = useState<ApplyTiming | null>(null)
  const [moveDriver, setMoveDriver] = useState<MoveDriver | null>(null)
  const [laidOffTiming, setLaidOffTiming] = useState<LaidOffTiming | null>(null)
  const [searchIntensity, setSearchIntensity] = useState<string | null>(profile.searchIntensity)
  const [aiJobLossReason, setAiJobLossReason] = useState<string | null>(profile.aiJobLossReason)
  const [networkComfortLevel, setNetworkComfortLevel] = useState<NetworkComfortLevel | null>(
    profile.networkComfortLevel
  )
  const [coachingStylePreference, setCoachingStylePreference] = useState<CoachingStylePreference | null>(
    profile.coachingStylePreference
  )

  return (
    <form
      action={formAction}
      className={`w-full max-w-xl space-y-5 text-left ${pending ? 'cursor-progress [&_*]:cursor-progress' : ''}`}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="currentCity">City</Label>
          <Input id="currentCity" name="currentCity" defaultValue={profile.currentCity ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currentState">State</Label>
          <Input id="currentState" name="currentState" defaultValue={profile.currentState ?? ''} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Work-location preference</Label>
        <ChoiceButtons
          name="remotePreference"
          options={LOCATION_PREFERENCE_OPTIONS}
          value={remotePreference as (typeof LOCATION_PREFERENCE_OPTIONS)[number]['value'] | null}
          onChange={setRemotePreference}
          responsive
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="openToRelocation"
            name="openToRelocation"
            value="on"
            defaultChecked={openToRelocation}
            onCheckedChange={(checked) => setOpenToRelocation(checked === true)}
          />
          <Label htmlFor="openToRelocation" className="font-normal">
            I&apos;m open to relocating for the right role
          </Label>
        </div>
        {openToRelocation && (
          <Textarea
            name="relocationNotes"
            defaultValue={profile.relocationNotes ?? ''}
            placeholder="Any constraints or preferred cities?"
            rows={2}
          />
        )}
      </div>

      {searching && (
        <div className="space-y-2">
          <Label htmlFor="payFloorBand">
            The least you would take <span className="text-muted-foreground">(optional)</span>
          </Label>
          <NativeSelect id="payFloorBand" name="payFloorBand" options={PAY_FLOOR_BANDS.map((b) => ({ value: b.value, label: b.label }))} defaultValue={bandForFloor(profile.targetCompMin)} placeholder="Prefer not to say yet" />
          <p className="text-sm text-muted-foreground">Total annual pay. It lets us show how many advertised roles clear your floor. Only you see it.</p>
        </div>
      )}

      {searching && (
        <>
        <div className="border-t border-border pt-5">
          <h2 className="text-sm font-semibold text-foreground">Where are you in your search?</h2>
          <p className="mt-1 text-sm text-muted-foreground">This tells us which part of the process to focus on first.</p>
        </div>

        {employed ? (
          <div className="space-y-2">
            <Label>When do you want to start applying?</Label>
            <ChoiceButtons
              name="applyTiming"
              options={APPLY_TIMING.map((t) => ({ value: t.key, label: t.label }))}
              value={applyTiming}
              onChange={setApplyTiming}
              responsive
            />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>How long have you been searching?</Label>
              <ChoiceButtons
                name="gapDuration"
                options={GAP_DURATION_OPTIONS}
                value={gapDuration}
                onChange={setGapDuration}
                responsive
              />
            </div>

            <div className="space-y-2">
              <Label>How actively are you looking?</Label>
              <ChoiceButtons
                name="searchIntensity"
                options={INTENSITY_OPTIONS.map((o) => ({ value: o.key, label: `${o.label}: ${o.hint}` }))}
                value={searchIntensity as (typeof INTENSITY_OPTIONS)[number]['key'] | null}
                onChange={setSearchIntensity}
                columns={2}
                responsive
              />
              <p className="text-sm text-muted-foreground">
                Casually looking means a lighter plan and fewer nudges, with the same tools. You can change this any time.
              </p>
              <div className="flex items-center gap-2">
                <Checkbox id="workingNow" name="workingNow" value="on" />
                <Label htmlFor="workingNow" className="font-normal">
                  I&apos;m earning from fractional, interim or part-time work right now
                </Label>
              </div>
            </div>
          </>
        )}

        <div className="flex items-center gap-2">
          <Checkbox
            id="justStartedSearch"
            name="justStartedSearch"
            value="on"
            defaultChecked={justStartedSearch}
            onCheckedChange={(checked) => setJustStartedSearch(checked === true)}
          />
          <Label htmlFor="justStartedSearch" className="font-normal">
            I just started my search — no applications or interviews yet
          </Label>
        </div>

        {!justStartedSearch && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="jobsAppliedCount">Roles applied to</Label>
                <Input id="jobsAppliedCount" name="jobsAppliedCount" type="number" min={0} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interviewsCount">Interviews</Label>
                <Input id="interviewsCount" name="interviewsCount" type="number" min={0} defaultValue={profile.interviewsReceivedCount ?? ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="offersCount">
                  Offers <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input id="offersCount" name="offersCount" type="number" min={0} defaultValue={profile.offersReceivedCount ?? ''} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="searchStallPoint">
                Where do your searches usually stall? <span className="text-muted-foreground">(optional)</span>
              </Label>
              <NativeSelect id="searchStallPoint" name="searchStallPoint" options={SEARCH_STALL_OPTIONS} defaultValue={profile.searchStallPoint} placeholder="Not sure yet" />
              <p className="text-sm text-muted-foreground">It tells us which part of the process to fix first. If you connect Gmail later, we count these for you.</p>
            </div>
          </>
        )}
        </>
      )}

      {searching && journey === 'EXPLORING_MOVE' && (
        <div className="space-y-2">
          <Label>
            What&apos;s behind the move? <span className="text-muted-foreground">(optional)</span>
          </Label>
          <ChoiceButtons
            name="moveDriver"
            options={MOVE_DRIVERS.map((d) => ({ value: d.key, label: d.label }))}
            value={moveDriver}
            onChange={setMoveDriver}
            columns={3}
            responsive
          />
        </div>
      )}

      {journey === 'LAID_OFF' && (
        <div className="space-y-2">
          <Label>
            When do you want to start looking? <span className="text-muted-foreground">(optional)</span>
          </Label>
          <ChoiceButtons
            name="startTiming"
            options={LAID_OFF_TIMING.map((t) => ({ value: t.key, label: t.label }))}
            value={laidOffTiming}
            onChange={setLaidOffTiming}
            columns={3}
            responsive
          />
          <p className="text-sm text-muted-foreground">Taking some time first is fine. We will still get your benefits and severance dates in front of you.</p>
        </div>
      )}

      {journey === 'TIME_OFF' && (
        <div className="space-y-1.5">
          <Label htmlFor="returnDate">
            When do you expect to be back? <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input id="returnDate" name="returnDate" type="date" />
          <p className="text-sm text-muted-foreground">We will check in as it gets close, and keep everything else light until then.</p>
        </div>
      )}

      {journey === 'FRACTIONAL' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="offering">
              In one line, who do you help and what result do you deliver? <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input id="offering" name="offering" maxLength={200} placeholder="I help Series B SaaS companies cut churn in two quarters" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="openDays">Days a week open for new work</Label>
              <Input id="openDays" name="openDays" type="number" min={0} max={5} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="engagementEnds">When does your current engagement end?</Label>
              <Input id="engagementEnds" name="engagementEnds" type="date" />
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-border pt-5">
        <h2 className="text-sm font-semibold text-foreground">One more thing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {searching
            ? "How comfortable do you feel letting your network know you're looking for a role?"
            : 'How comfortable do you feel reaching out to people in your network about your career?'}
        </p>
      </div>

      <ChoiceButtons
        name="networkComfortLevel"
        options={NETWORK_COMFORT_OPTIONS}
        value={networkComfortLevel}
        onChange={setNetworkComfortLevel}
        columns={2}
        responsive
      />

      <details className="rounded-lg border border-border p-4 [&_summary]:cursor-pointer">
        <summary className="text-sm font-medium text-foreground">A few optional extras</summary>
        <p className="mt-2 text-sm text-muted-foreground">
          Skip these now if you like. Each one only sharpens your plan, and you can answer any of them later from your profile.
        </p>
        <div className="mt-4 space-y-5">
          <div className="flex items-center gap-2">
            <Checkbox
              id="travelWillingness"
              name="travelWillingness"
              value="on"
              defaultChecked={travelWillingness}
              onCheckedChange={(checked) => setTravelWillingness(checked === true)}
            />
            <Label htmlFor="travelWillingness" className="font-normal">
              I&apos;m willing to travel for a role (not the same as relocating)
            </Label>
          </div>

          {searching && !employed && (
            <div className="space-y-2">
              <Label>
                Was AI part of why your last role ended? <span className="text-muted-foreground">(optional)</span>
              </Label>
              <ChoiceButtons
                name="aiJobLossReason"
                options={AI_JOB_LOSS_OPTIONS}
                value={aiJobLossReason as (typeof AI_JOB_LOSS_OPTIONS)[number]['value'] | null}
                onChange={setAiJobLossReason}
                responsive
              />
            </div>

          )}
          {searching && journey !== 'GROWING' && (
            <CultureFitFields defaults={parseCultureFit(profile.cultureFit)} />
          )}
          <div className="space-y-2">
            <Label>
              When you&apos;re stuck, what kind of push works better for you? <span className="text-muted-foreground">(optional)</span>
            </Label>
            <p className="text-sm text-muted-foreground">
              This sets how direct your coaching feedback is. You can change it any time on your profile.
            </p>
            <ChoiceButtons
              name="coachingStylePreference"
              options={COACHING_STYLE_OPTIONS}
              value={coachingStylePreference}
              onChange={setCoachingStylePreference}
              columns={3}
              responsive
            />
          </div>
        </div>
      </details>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton className="w-full">Continue</SubmitButton>
    </form>
  )
}
