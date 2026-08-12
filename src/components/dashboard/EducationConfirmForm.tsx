'use client'

import { useActionState, useState } from 'react'
import type { HighestEducationLevel } from '@prisma/client'
import { confirmEducation } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { DEGREE_OPTIONS, legacyLevelToOption, impliedLevels } from '@/lib/constants/education'
import { cn } from '@/lib/utils'

export function EducationConfirmForm({
  highestEducationLevel,
  hasJD,
  hasMD,
  hasMBA,
}: {
  highestEducationLevel: HighestEducationLevel | null
  hasJD: boolean
  hasMD: boolean
  hasMBA: boolean
}) {
  const [state, formAction, pending] = useActionState(confirmEducation, undefined)

  const initialChecked = impliedLevels(
    new Set<HighestEducationLevel>(
      [
        highestEducationLevel ? legacyLevelToOption(highestEducationLevel) : null,
        hasJD ? 'JD' : null,
        hasMD ? 'MD' : null,
        hasMBA ? 'MBA' : null,
        highestEducationLevel === 'PHD' ? 'PHD' : null,
      ].filter((v): v is HighestEducationLevel => !!v)
    )
  )
  const [checked, setChecked] = useState(initialChecked)

  function toggle(value: HighestEducationLevel, isChecked: boolean) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (isChecked) next.add(value)
      else next.delete(value)
      return next
    })
  }

  return (
    <form action={formAction} className={cn('space-y-3', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <div className="space-y-2">
        <Label>Education</Label>
        {DEGREE_OPTIONS.map((opt) => (
          <div key={opt.value} className="flex items-center gap-2">
            <Checkbox
              id={`degree-${opt.value}`}
              name="degrees"
              value={opt.value}
              checked={checked.has(opt.value)}
              onCheckedChange={(isChecked) => toggle(opt.value, !!isChecked)}
            />
            <Label htmlFor={`degree-${opt.value}`} className="font-normal">
              {opt.label}
            </Label>
          </div>
        ))}
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
