'use client'

import { useActionState, useEffect, useState } from 'react'
import { updateCircumstances } from '@/app/onboarding/actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { FourStopSlider } from './FourStopSlider'
import { ChoiceButtons } from './ChoiceButtons'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CURRENT_JOB_STATUS_LABELS,
  GAP_DURATION_LABELS,
  LOCATION_PREFERENCE_OPTIONS,
  JOB_SEARCH_DIFFICULTY_OPTIONS,
  SITUATION_TO_JOB_STATUS,
  SITUATION_SESSION_KEY,
  type SituationKey,
} from '@/lib/constants/onboarding'
import { cn } from '@/lib/utils'
import type { CandidateProfile } from '@prisma/client'

const DESIRE_CHOICES = [
  { value: 10, label: 'Casually looking' },
  { value: 40, label: "I'm interested and will work hard" },
  { value: 70, label: 'I really need a job and will work extremely hard' },
  { value: 100, label: "I need this and will do whatever it takes" },
] as const

const JOBS_APPLIED_OPTIONS = [
  { value: '0-20', label: '0–20' },
  { value: '20-100', label: '20–100' },
  { value: '100+', label: '100+' },
] as const

const NETWORKING_LEVEL_OPTIONS = [
  { value: '1', label: 'Not much' },
  { value: '2', label: 'Some, but I should do more' },
  { value: '3', label: 'A lot' },
  { value: '4', label: "I can't do more" },
] as const

const LEARNED_NEW_SKILLS_OPTIONS = [
  { value: '1', label: 'Not yet' },
  { value: '2', label: 'A little' },
  { value: '3', label: 'Yes, actively' },
] as const

const YES_NO_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const

export function CircumstancesForm({ profile }: { profile: CandidateProfile }) {
  const [state, formAction, pending] = useActionState(updateCircumstances, undefined)
  const [currentJobStatus, setCurrentJobStatus] = useState(profile.currentJobStatus ?? '')
  const [remotePreference, setRemotePreference] = useState(profile.remotePreference ?? '')
  const [jobSearchDifficulty, setJobSearchDifficulty] = useState<number | null>(
    profile.jobSearchDifficultyLevel
  )
  const [jobSearchIntensity, setJobSearchIntensity] = useState<number>(
    profile.jobSearchIntensity ?? DESIRE_CHOICES[0].value
  )
  const [prefilledFromHomepage, setPrefilledFromHomepage] = useState(Boolean(profile.currentJobStatus))
  const [overridePrefill, setOverridePrefill] = useState(false)
  const isNewGrad = currentJobStatus === 'NEW_GRADUATE_FIRST_JOB'

  const [jobsAppliedBucket, setJobsAppliedBucket] = useState(profile.jobsAppliedBucket ?? '')
  const [networkingLevel, setNetworkingLevel] = useState(
    profile.networkingLevel ? String(profile.networkingLevel) : ''
  )
  const [learnedNewSkillsLevel, setLearnedNewSkillsLevel] = useState(
    profile.learnedNewSkillsLevel ? String(profile.learnedNewSkillsLevel) : ''
  )
  const [triedPartTimeOrConsulting, setTriedPartTimeOrConsulting] = useState(
    profile.triedPartTimeOrConsulting === null ? '' : profile.triedPartTimeOrConsulting ? 'yes' : 'no'
  )
  const [triedExecutiveCoaching, setTriedExecutiveCoaching] = useState(
    profile.triedExecutiveCoaching === null ? '' : profile.triedExecutiveCoaching ? 'yes' : 'no'
  )
  const [connectedWithRecruiters, setConnectedWithRecruiters] = useState(
    profile.connectedWithRecruiters === null ? '' : profile.connectedWithRecruiters ? 'yes' : 'no'
  )

  // A homepage situational card, or the persona step just before this one,
  // already told us the answer to this question — skip asking it again, but
  // keep an escape hatch to correct it.
  useEffect(() => {
    if (profile.currentJobStatus) return
    const situation = sessionStorage.getItem(SITUATION_SESSION_KEY) as SituationKey | null
    if (situation && situation in SITUATION_TO_JOB_STATUS) {
      // One-time adoption of external (sessionStorage) state on mount, not a
      // derived-render loop — safe despite the general set-state-in-effect rule.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentJobStatus(SITUATION_TO_JOB_STATUS[situation])
      setPrefilledFromHomepage(true)
    }
    sessionStorage.removeItem(SITUATION_SESSION_KEY)
    // Only ever runs once, against the profile this component mounted with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <form
      action={formAction}
      className={cn('space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-2">
        <Label htmlFor="currentJobStatus">What best describes your job status?</Label>
        {prefilledFromHomepage && !overridePrefill ? (
          <div className="flex items-center justify-between rounded-lg border border-light-gray bg-off-white px-4 py-3">
            <div>
              <p className="text-sm text-muted-foreground">You told us:</p>
              <p className="font-medium text-foreground">
                {CURRENT_JOB_STATUS_LABELS[currentJobStatus as keyof typeof CURRENT_JOB_STATUS_LABELS]}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOverridePrefill(true)}
              className="text-sm font-medium text-brand underline underline-offset-4"
            >
              Not right? Change
            </button>
            <input type="hidden" name="currentJobStatus" value={currentJobStatus} />
          </div>
        ) : (
          <Select
            name="currentJobStatus"
            value={currentJobStatus}
            onValueChange={(value) => setCurrentJobStatus(value ?? '')}
          >
            <SelectTrigger id="currentJobStatus" className="w-full">
              <SelectValue placeholder="Select one">
                {(value: string | null) =>
                  value
                    ? CURRENT_JOB_STATUS_LABELS[value as keyof typeof CURRENT_JOB_STATUS_LABELS]
                    : 'Select one'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CURRENT_JOB_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {currentJobStatus && currentJobStatus !== 'EMPLOYED_CONSIDERING_MOVE' && !isNewGrad && (
        <div className="space-y-2">
          <Label htmlFor="gapDuration">How long since your last job?</Label>
          <Select name="gapDuration" defaultValue={profile.gapDuration ?? undefined}>
            <SelectTrigger id="gapDuration" className="w-full">
              <SelectValue placeholder="Select one">
                {(value: string | null) =>
                  value ? GAP_DURATION_LABELS[value as keyof typeof GAP_DURATION_LABELS] : 'Select one'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(GAP_DURATION_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

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

      <div className="space-y-2">
        <Label>How much do you want to get a job?</Label>
        <FourStopSlider
          name="jobSearchIntensity"
          choices={DESIRE_CHOICES}
          defaultValue={profile.jobSearchIntensity}
          onChange={setJobSearchIntensity}
        />
        {jobSearchIntensity < 25 && (
          <p className="rounded-md border border-orange/30 bg-orange/5 p-3 text-sm text-foreground">
            Honestly — this level of intensity will show up in your Market Reality Grade. Recruiters
            notice candidates who are all-in. If you&apos;re just testing the waters, that&apos;s
            okay, but know it will affect your grade until that changes.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>How difficult has your job search been so far?</Label>
        <FourStopSlider
          name="jobSearchDifficultyLevel"
          choices={JOB_SEARCH_DIFFICULTY_OPTIONS}
          defaultValue={jobSearchDifficulty}
          onChange={setJobSearchDifficulty}
        />
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-off-white p-4">
        <p className="text-sm font-medium text-foreground">
          A few questions about your search so far — all optional.
        </p>

        <div className="space-y-2">
          <Label>How many jobs have you applied for? (optional)</Label>
          <ChoiceButtons
            name="jobsAppliedBucket"
            options={JOBS_APPLIED_OPTIONS}
            value={jobsAppliedBucket || null}
            onChange={setJobsAppliedBucket}
            columns={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="interviewsReceivedCount">How many interviews have you received? (optional)</Label>
          <Input
            id="interviewsReceivedCount"
            name="interviewsReceivedCount"
            type="number"
            min={0}
            defaultValue={profile.interviewsReceivedCount ?? ''}
          />
        </div>

        <div className="space-y-2">
          <Label>How much have you been networking? (optional)</Label>
          <ChoiceButtons
            name="networkingLevel"
            options={NETWORKING_LEVEL_OPTIONS}
            value={networkingLevel || null}
            onChange={setNetworkingLevel}
            columns={4}
          />
        </div>

        <div className="space-y-2">
          <Label>Have you used your time to learn new skills? (optional)</Label>
          <ChoiceButtons
            name="learnedNewSkillsLevel"
            options={LEARNED_NEW_SKILLS_OPTIONS}
            value={learnedNewSkillsLevel || null}
            onChange={setLearnedNewSkillsLevel}
            columns={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Have you used your time to get a part-time/interim job or done consulting? (optional)</Label>
          <ChoiceButtons
            name="triedPartTimeOrConsulting"
            options={YES_NO_OPTIONS}
            value={triedPartTimeOrConsulting || null}
            onChange={setTriedPartTimeOrConsulting}
            columns={2}
          />
        </div>

        <div className="space-y-2">
          <Label>Have you tried Executive Coaching? (optional)</Label>
          <ChoiceButtons
            name="triedExecutiveCoaching"
            options={YES_NO_OPTIONS}
            value={triedExecutiveCoaching || null}
            onChange={setTriedExecutiveCoaching}
            columns={2}
          />
        </div>

        <div className="space-y-2">
          <Label>Have you connected with recruiters? (optional)</Label>
          <ChoiceButtons
            name="connectedWithRecruiters"
            options={YES_NO_OPTIONS}
            value={connectedWithRecruiters || null}
            onChange={setConnectedWithRecruiters}
            columns={2}
          />
          {connectedWithRecruiters === 'yes' && (
            <Input
              name="recruiterConnectionCount"
              type="number"
              min={0}
              placeholder="How many? (optional)"
              defaultValue={profile.recruiterConnectionCount ?? ''}
            />
          )}
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Continue'}
      </Button>
    </form>
  )
}
