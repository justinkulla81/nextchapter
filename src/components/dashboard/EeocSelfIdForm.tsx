'use client'

import { updateEeocSelfId } from '@/app/dashboard/actions'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { EeocGenderIdentity, EeocRaceEthnicity, EeocYesNoDecline } from '@prisma/client'

const PREFER_NOT_TO_ANSWER = 'Prefer not to answer'

const GENDER_OPTIONS: { value: EeocGenderIdentity; label: string }[] = [
  { value: 'WOMAN', label: 'Woman' },
  { value: 'MAN', label: 'Man' },
  { value: 'NON_BINARY', label: 'Non-binary' },
  { value: 'SELF_DESCRIBE', label: 'Prefer to self-describe' },
  { value: 'PREFER_NOT_TO_ANSWER', label: PREFER_NOT_TO_ANSWER },
]

const RACE_OPTIONS: { value: EeocRaceEthnicity; label: string }[] = [
  { value: 'AMERICAN_INDIAN_ALASKA_NATIVE', label: 'American Indian or Alaska Native' },
  { value: 'ASIAN', label: 'Asian' },
  { value: 'BLACK_AFRICAN_AMERICAN', label: 'Black or African American' },
  { value: 'HISPANIC_LATINO', label: 'Hispanic or Latino' },
  { value: 'MIDDLE_EASTERN_NORTH_AFRICAN', label: 'Middle Eastern or North African' },
  { value: 'NATIVE_HAWAIIAN_PACIFIC_ISLANDER', label: 'Native Hawaiian or Pacific Islander' },
  { value: 'WHITE', label: 'White' },
  { value: 'TWO_OR_MORE_RACES', label: 'Two or more races' },
  { value: 'PREFER_NOT_TO_ANSWER', label: PREFER_NOT_TO_ANSWER },
]

const YES_NO_OPTIONS: { value: EeocYesNoDecline; label: string }[] = [
  { value: 'YES', label: 'Yes' },
  { value: 'NO', label: 'No' },
  { value: 'PREFER_NOT_TO_ANSWER', label: PREFER_NOT_TO_ANSWER },
]

interface EeocSelfIdFormProps {
  eeocGenderIdentity: EeocGenderIdentity | null
  eeocRaceEthnicity: EeocRaceEthnicity | null
  eeocDisabilityStatus: EeocYesNoDecline | null
  eeocVeteranStatus: EeocYesNoDecline | null
}

export function EeocSelfIdForm({
  eeocGenderIdentity,
  eeocRaceEthnicity,
  eeocDisabilityStatus,
  eeocVeteranStatus,
}: EeocSelfIdFormProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        This helps us check our own system for bias — it&apos;s never used to personalize what you
        see, and it&apos;s never shared outside internal fairness reviews. Every question here is
        optional — skip anything you&apos;d rather not answer.
      </p>
      <form action={updateEeocSelfId} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="eeocGenderIdentity">Gender identity</Label>
            <Select name="eeocGenderIdentity" defaultValue={eeocGenderIdentity ?? undefined}>
              <SelectTrigger id="eeocGenderIdentity">
                <SelectValue placeholder="Prefer not to answer" />
              </SelectTrigger>
              <SelectContent>
                {GENDER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="eeocRaceEthnicity">Race / ethnicity</Label>
            <Select name="eeocRaceEthnicity" defaultValue={eeocRaceEthnicity ?? undefined}>
              <SelectTrigger id="eeocRaceEthnicity">
                <SelectValue placeholder="Prefer not to answer" />
              </SelectTrigger>
              <SelectContent>
                {RACE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="eeocDisabilityStatus">Disability status</Label>
            <Select name="eeocDisabilityStatus" defaultValue={eeocDisabilityStatus ?? undefined}>
              <SelectTrigger id="eeocDisabilityStatus">
                <SelectValue placeholder="Prefer not to answer" />
              </SelectTrigger>
              <SelectContent>
                {YES_NO_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="eeocVeteranStatus">Veteran status</Label>
            <Select name="eeocVeteranStatus" defaultValue={eeocVeteranStatus ?? undefined}>
              <SelectTrigger id="eeocVeteranStatus">
                <SelectValue placeholder="Prefer not to answer" />
              </SelectTrigger>
              <SelectContent>
                {YES_NO_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <SubmitButton variant="outline" pendingLabel="Saving…">
          Save
        </SubmitButton>
      </form>
    </div>
  )
}
