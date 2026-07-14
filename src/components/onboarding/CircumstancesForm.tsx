'use client'

import { useActionState, useState } from 'react'
import { updateCircumstances } from '@/app/onboarding/actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { FourStopSlider } from './FourStopSlider'
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
} from '@/lib/constants/onboarding'
import { cn } from '@/lib/utils'
import type { CandidateProfile } from '@prisma/client'

export function CircumstancesForm({ profile }: { profile: CandidateProfile }) {
  const [state, formAction, pending] = useActionState(updateCircumstances, undefined)
  const [currentJobStatus, setCurrentJobStatus] = useState(profile.currentJobStatus ?? '')
  const [remotePreference, setRemotePreference] = useState(profile.remotePreference ?? '')
  const [openToRelocation, setOpenToRelocation] = useState(profile.openToRelocation)
  const [jobSearchDifficulty, setJobSearchDifficulty] = useState<number | null>(
    profile.jobSearchDifficultyLevel
  )
  const isNewGrad = currentJobStatus === 'NEW_GRADUATE_FIRST_JOB'

  return (
    <form
      action={formAction}
      className={cn('space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-2">
        <Label htmlFor="currentJobStatus">What best describes your job status?</Label>
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
            id="relocationNotes"
            name="relocationNotes"
            placeholder="Relocation notes (optional)"
            defaultValue={profile.relocationNotes ?? ''}
            rows={2}
          />
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

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Continue'}
      </Button>
    </form>
  )
}
