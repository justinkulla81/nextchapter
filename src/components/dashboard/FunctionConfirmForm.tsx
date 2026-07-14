'use client'

import { useActionState } from 'react'
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

export function FunctionConfirmForm({
  primaryFunction,
  resumeLatestJobTitle,
  yearsExperience,
  highestLevelReached,
}: {
  primaryFunction: string | null
  resumeLatestJobTitle: string | null
  yearsExperience: number | null
  highestLevelReached: string | null
}) {
  const [state, formAction, pending] = useActionState(confirmFunctionAndExperience, undefined)

  return (
    <form action={formAction} className="space-y-2">
      <Select name="primaryFunction" defaultValue={primaryFunction ?? undefined}>
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
        defaultValue={resumeLatestJobTitle ?? ''}
      />
      <Input
        name="yearsExperience"
        type="number"
        min={0}
        max={60}
        placeholder="Years of experience"
        defaultValue={yearsExperience ?? undefined}
      />
      <Select name="highestLevelReached" defaultValue={highestLevelReached ?? undefined}>
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
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? 'Saving…' : 'Confirm'}
      </Button>
      <Label className="block text-xs font-normal text-muted-foreground">
        Pre-filled from your resume — correct anything that&apos;s off.
      </Label>
    </form>
  )
}
