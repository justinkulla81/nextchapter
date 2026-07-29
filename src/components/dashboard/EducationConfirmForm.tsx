'use client'

import { useActionState, useState } from 'react'
import type { HighestEducationLevel } from '@prisma/client'
import { confirmEducation } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

const LEVEL_LABELS: Record<HighestEducationLevel, string> = {
  SOME_COLLEGE: 'Some college, no degree',
  ASSOCIATE: "Associate's degree",
  BACHELORS: "Bachelor's degree",
  MASTERS: "Master's degree",
  MBA: 'MBA',
  JD: 'JD',
  MD: 'MD',
  PHD: 'PhD',
  OTHER: 'Other',
}

export function EducationConfirmForm({
  highestEducationLevel,
  hasMBA,
}: {
  highestEducationLevel: HighestEducationLevel | null
  hasMBA: boolean
}) {
  const [state, formAction, pending] = useActionState(confirmEducation, undefined)
  const [level, setLevel] = useState<HighestEducationLevel | ''>(highestEducationLevel ?? '')

  return (
    <form
      action={formAction}
      className={cn('space-y-3', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-1">
        <Label htmlFor="highestEducationLevel">Highest degree completed</Label>
        <select
          id="highestEducationLevel"
          name="highestEducationLevel"
          value={level}
          onChange={(e) => setLevel(e.target.value as HighestEducationLevel)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Not set</option>
          {(Object.keys(LEVEL_LABELS) as HighestEducationLevel[]).map((key) => (
            <option key={key} value={key}>
              {LEVEL_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="hasMBA" name="hasMBA" value="on" defaultChecked={hasMBA} />
        <Label htmlFor="hasMBA" className="font-normal">
          I have an MBA
        </Label>
      </div>

      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}

      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </Button>

      <Label className="block text-xs font-normal text-muted-foreground">
        Pre-filled from your resume where possible — used to understand how education correlates
        with job search outcomes, never shown to hiring managers.
      </Label>
    </form>
  )
}
