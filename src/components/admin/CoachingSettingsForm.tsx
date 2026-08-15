'use client'

import { useActionState } from 'react'
import type { CoachingSettings } from '@prisma/client'
import type { FormState } from '@/app/support/admin/(portal)/coaching-settings/actions'
import { COACHING_ELIGIBLE_PLAN_KEYS } from '@/lib/constants/coaching-eligible-plans'
import { PLAN_LABELS } from '@/lib/constants/plan-catalog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

const ASSIGNMENT_MODES: { value: CoachingSettings['assignmentMode']; label: string }[] = [
  { value: 'AUTO_MATCH', label: 'Auto-match' },
  { value: 'ADMIN_ASSIGN', label: 'Admin-assign' },
  { value: 'CANDIDATE_CHOICE', label: 'Candidate choice' },
]

const UNUSED_HOURS_POLICIES: { value: CoachingSettings['unusedHoursPolicy']; label: string }[] = [
  { value: 'EXPIRE', label: 'Expire' },
  { value: 'ROLLOVER', label: 'Roll over' },
  { value: 'REFUND', label: 'Refund' },
]

function Field({ label, name, defaultValue, hint }: { label: string; name: string; defaultValue: number; hint?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="number" min={0} defaultValue={defaultValue} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function CoachingSettingsForm({
  action,
  existing,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>
  existing: CoachingSettings
}) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const sessionsIncludedByPlan = (existing.sessionsIncludedByPlan as Record<string, number>) ?? {}

  return (
    <form
      action={formAction}
      className={cn('space-y-8 rounded-lg border border-border p-4', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-4">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Sessions</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Default session length (min)" name="sessionLengthMinutesDefault" defaultValue={existing.sessionLengthMinutesDefault} />
          <Field label="Max active clients per coach" name="coachMaxActiveClients" defaultValue={existing.coachMaxActiveClients} />
        </div>
        <div>
          <Label>Sessions included per plan (per billing period)</Label>
          <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {COACHING_ELIGIBLE_PLAN_KEYS.map((key) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={`sessionsIncluded_${key}`} className="text-xs font-normal text-muted-foreground">
                  {PLAN_LABELS[key]}
                </Label>
                <Input
                  id={`sessionsIncluded_${key}`}
                  name={`sessionsIncluded_${key}`}
                  type="number"
                  min={0}
                  defaultValue={sessionsIncludedByPlan[key] ?? ''}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Matching weights</h3>
        <p className="text-xs text-muted-foreground">
          Consumed by the coach shortlist (src/lib/coach/matching.ts). Timezone and style aren&apos;t wired into a
          weighted score yet — timezone is a hard filter, style has no signal built — so those two fields are stored
          for later use only.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Field label="Function / industry" name="matchWeightFunctionIndustry" defaultValue={existing.matchWeightFunctionIndustry} />
          <Field label="Level / seniority" name="matchWeightSeniorityLevel" defaultValue={existing.matchWeightSeniorityLevel} />
          <Field label="High-need boost" name="matchWeightHighNeedBoost" defaultValue={existing.matchWeightHighNeedBoost} />
          <Field label="Timezone (reserved)" name="matchWeightTimezone" defaultValue={existing.matchWeightTimezone} />
          <Field label="Style (reserved)" name="matchWeightStyle" defaultValue={existing.matchWeightStyle} />
          <Field
            label="Membership priority boost"
            name="matchWeightMembershipPriorityBoost"
            defaultValue={existing.matchWeightMembershipPriorityBoost}
            hint="Applied only to active Members with priority booking on, scaled by coach capacity headroom"
          />
        </div>
        <Field label="Shortlist size" name="matchShortlistSize" defaultValue={existing.matchShortlistSize} />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Assignment mode</h3>
        <div className="flex flex-wrap gap-2">
          {ASSIGNMENT_MODES.map((mode) => (
            <label
              key={mode.value}
              className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input type="radio" name="assignmentMode" value={mode.value} required defaultChecked={existing.assignmentMode === mode.value} />
              {mode.label}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Cancellation, no-show & unused hours
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Cancellation window (hours)" name="cancellationWindowHours" defaultValue={existing.cancellationWindowHours} />
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="noShowConsumesHour" defaultChecked={existing.noShowConsumesHour} />
            No-show consumes the hour
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="lateCancelConsumesHour" defaultChecked={existing.lateCancelConsumesHour} />
            Late cancellation consumes the hour
          </label>
        </div>
        <div className="space-y-2">
          <Label>Unused hours at contract end</Label>
          <div className="flex flex-wrap gap-2">
            {UNUSED_HOURS_POLICIES.map((policy) => (
              <label
                key={policy.value}
                className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input
                  type="radio"
                  name="unusedHoursPolicy"
                  value={policy.value}
                  required
                  defaultChecked={existing.unusedHoursPolicy === policy.value}
                />
                {policy.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Response-time SLA (hours)</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Core" name="responseTimeSlaHoursCore" defaultValue={existing.responseTimeSlaHoursCore} />
          <Field label="Plus" name="responseTimeSlaHoursPlus" defaultValue={existing.responseTimeSlaHoursPlus} />
          <Field label="Premium" name="responseTimeSlaHoursPremium" defaultValue={existing.responseTimeSlaHoursPremium} />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Trigger thresholds</h3>
        <p className="text-xs text-muted-foreground">
          Streak-break is wired to real detection today (a coaching action type committed but never completed across
          this many recent weeks). Interviews-without-offers and dormancy days are stored for a not-yet-built
          detector — see this phase&apos;s report.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Interviews without offers" name="interviewsWithoutOffersThreshold" defaultValue={existing.interviewsWithoutOffersThreshold} />
          <Field label="Dormancy (days)" name="dormancyDaysThreshold" defaultValue={existing.dormancyDaysThreshold} />
          <Field label="Streak break (weeks)" name="streakBreakWeeksThreshold" defaultValue={existing.streakBreakWeeksThreshold} />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Escalation, ratings & surge</h3>
        <div className="space-y-2">
          <Label htmlFor="escalationReassignmentPolicy">Escalation / reassignment policy</Label>
          <Textarea
            id="escalationReassignmentPolicy"
            name="escalationReassignmentPolicy"
            rows={2}
            defaultValue={existing.escalationReassignmentPolicy ?? ''}
            placeholder="Policy text shown alongside the one-tap reassignment flow"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="sessionRatingPromptEnabled" defaultChecked={existing.sessionRatingPromptEnabled} />
          Prompt candidates to rate sessions
        </label>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="sessionRatingRemovalThreshold">Removal threshold (avg rating, optional)</Label>
            <Input
              id="sessionRatingRemovalThreshold"
              name="sessionRatingRemovalThreshold"
              type="number"
              min={0}
              max={5}
              step="0.1"
              defaultValue={existing.sessionRatingRemovalThreshold?.toString() ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="surgeCapacityBenchThreshold">Surge capacity bench threshold (optional)</Label>
            <Input
              id="surgeCapacityBenchThreshold"
              name="surgeCapacityBenchThreshold"
              type="number"
              min={0}
              defaultValue={existing.surgeCapacityBenchThreshold ?? ''}
            />
          </div>
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Saving…">Save coaching settings</SubmitButton>
    </form>
  )
}
