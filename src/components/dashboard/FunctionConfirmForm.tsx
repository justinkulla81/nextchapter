'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { confirmFunctionAndExperience } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { ConfirmHint } from '@/components/dashboard/ConfirmHint'
import { cn } from '@/lib/utils'

const POINTS = estimateActionEffort({ actionType: 'FUNCTION_CONFIRM' }).points

export function FunctionConfirmForm({
  primaryFunction,
  resumeLatestJobTitle,
  yearsExperience,
  confirmedAt,
}: {
  primaryFunction: string | null
  resumeLatestJobTitle: string | null
  yearsExperience: number | null
  confirmedAt: Date | null
}) {
  const [state, formAction, pending] = useActionState(confirmFunctionAndExperience, undefined)

  const [values, setValues] = useState({
    resumeLatestJobTitle: resumeLatestJobTitle ?? '',
    yearsExperience: yearsExperience != null ? String(yearsExperience) : '',
  })

  const isConfirmed = !!confirmedAt
  const isDirty =
    values.resumeLatestJobTitle !== (resumeLatestJobTitle ?? '') ||
    values.yearsExperience !== (yearsExperience != null ? String(yearsExperience) : '')
  const canConfirm = !isConfirmed || isDirty

  return (
    <form
      action={formAction}
      className={cn('space-y-2', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <ConfirmHint show={!isConfirmed} />
      <p className="text-sm text-foreground">
        Primary function: <span className="font-medium">{primaryFunction ?? 'Not set'}</span>{' '}
        <Link href="/dashboard/search-strategy" className="text-brand underline underline-offset-2">
          Edit on Search Strategy
        </Link>
      </p>
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
