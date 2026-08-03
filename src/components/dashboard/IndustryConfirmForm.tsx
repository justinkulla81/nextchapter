'use client'

import { useActionState, useState } from 'react'
import { confirmIndustry } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmHint } from '@/components/dashboard/ConfirmHint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { cn } from '@/lib/utils'

const POINTS = estimateActionEffort({ actionType: 'INDUSTRY_CONFIRM' }).points

export function IndustryConfirmForm({
  industryContext,
  confirmedAt,
}: {
  industryContext: string | null
  confirmedAt: Date | null
}) {
  const [state, formAction, pending] = useActionState(confirmIndustry, undefined)
  const [value, setValue] = useState(industryContext ?? '')

  const isConfirmed = !!confirmedAt
  const isDirty = value !== (industryContext ?? '')
  const canConfirm = !isConfirmed || isDirty

  return (
    <form
      action={formAction}
      className={cn('space-y-2', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <ConfirmHint show={!isConfirmed} />
      <Input name="industryContext" placeholder="Industry" value={value} onChange={(e) => setValue(e.target.value)} />
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" variant={canConfirm ? 'outline' : 'ghost'} disabled={pending || !canConfirm}>
          {pending ? 'Saving…' : isConfirmed ? (isDirty ? 'Reconfirm' : 'Confirmed') : 'Confirm'}
        </Button>
        {!isConfirmed && <span className="text-xs font-medium text-muted-foreground tabular-nums">+{POINTS} pts</span>}
      </div>
      <Label className="block text-xs font-normal text-muted-foreground">
        Pre-filled from your resume — correct anything that&apos;s off. If your background spans a
        second industry (e.g. a recent pivot), add that on{' '}
        <a href="/dashboard/search-strategy" className="underline">
          Search Strategy
        </a>{' '}
        instead — that&apos;s where it gets matched against jobs.
      </Label>
    </form>
  )
}
