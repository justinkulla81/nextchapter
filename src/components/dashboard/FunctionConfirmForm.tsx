'use client'

import { useActionState, useState } from 'react'
import { confirmFunctionAndExperience } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PRIMARY_FUNCTION_OPTIONS, HIGHEST_LEVEL_OPTIONS } from '@/lib/constants/onboarding'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { cn } from '@/lib/utils'

const POINTS = estimateActionEffort({ actionType: 'FUNCTION_CONFIRM' }).points

export function FunctionConfirmForm({
  primaryFunction,
  resumeLatestJobTitle,
  yearsExperience,
  highestLevelReached,
  confirmedAt,
}: {
  primaryFunction: string | null
  resumeLatestJobTitle: string | null
  yearsExperience: number | null
  highestLevelReached: string | null
  confirmedAt: Date | null
}) {
  const [state, formAction, pending] = useActionState(confirmFunctionAndExperience, undefined)

  const [values, setValues] = useState({
    primaryFunction: primaryFunction ?? '',
    resumeLatestJobTitle: resumeLatestJobTitle ?? '',
    yearsExperience: yearsExperience != null ? String(yearsExperience) : '',
    highestLevelReached: highestLevelReached ?? '',
  })

  const isConfirmed = !!confirmedAt
  const isDirty =
    values.primaryFunction !== (primaryFunction ?? '') ||
    values.resumeLatestJobTitle !== (resumeLatestJobTitle ?? '') ||
    values.yearsExperience !== (yearsExperience != null ? String(yearsExperience) : '') ||
    values.highestLevelReached !== (highestLevelReached ?? '')
  const canConfirm = !isConfirmed || isDirty

  return (
    <form
      action={formAction}
      className={cn('space-y-2', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <Select
        name="primaryFunction"
        value={values.primaryFunction || null}
        onValueChange={(v) => setValues((prev) => ({ ...prev, primaryFunction: (v as string) ?? '' }))}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Primary function" />
        </SelectTrigger>
        <SelectContent>
          {PRIMARY_FUNCTION_OPTIONS.map((fn) => (
            <SelectItem key={fn} value={fn}>
              {fn}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        name="resumeLatestJobTitle"
        placeholder="Latest job title"
        value={values.resumeLatestJobTitle}
        onChange={(e) => setValues((v) => ({ ...v, resumeLatestJobTitle: e.target.value }))}
      />
      <div className="flex items-center gap-2">
        <Input
          name="yearsExperience"
          type="number"
          min={0}
          max={60}
          placeholder="Years of experience"
          value={values.yearsExperience}
          onChange={(e) => setValues((v) => ({ ...v, yearsExperience: e.target.value }))}
          className="w-32"
        />
        <span className="text-sm text-muted-foreground">years</span>
      </div>
      <Select
        name="highestLevelReached"
        value={values.highestLevelReached || null}
        onValueChange={(v) => setValues((prev) => ({ ...prev, highestLevelReached: (v as string) ?? '' }))}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Highest level reached" />
        </SelectTrigger>
        <SelectContent>
          {HIGHEST_LEVEL_OPTIONS.map((level) => (
            <SelectItem key={level} value={level}>
              {level}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" variant={canConfirm ? 'outline' : 'ghost'} disabled={pending || !canConfirm}>
          {pending ? 'Saving…' : isConfirmed ? (isDirty ? 'Reconfirm' : 'Confirmed') : 'Confirm'}
        </Button>
        {!isConfirmed && <span className="text-xs font-medium text-muted-foreground tabular-nums">+{POINTS} pts</span>}
      </div>
      <Label className="block text-xs font-normal text-muted-foreground">
        Pre-filled from your resume — correct anything that&apos;s off.
      </Label>
    </form>
  )
}
