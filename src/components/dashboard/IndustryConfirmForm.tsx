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
  secondaryIndustryContext,
  confirmedAt,
}: {
  industryContext: string | null
  secondaryIndustryContext: string | null
  confirmedAt: Date | null
}) {
  const [state, formAction, pending] = useActionState(confirmIndustry, undefined)
  const [value, setValue] = useState(industryContext ?? '')
  const [secondaryValue, setSecondaryValue] = useState(secondaryIndustryContext ?? '')

  const isConfirmed = !!confirmedAt
  const isDirty = value !== (industryContext ?? '') || secondaryValue !== (secondaryIndustryContext ?? '')
  const canConfirm = !isConfirmed || isDirty

  return (
    <form
      action={formAction}
      className={cn('space-y-2', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <ConfirmHint show={!isConfirmed} />
      <Input name="industryContext" placeholder="Industry" value={value} onChange={(e) => setValue(e.target.value)} />
      <Input
        name="secondaryIndustryContext"
        placeholder="Second industry (optional)"
        value={secondaryValue}
        onChange={(e) => setSecondaryValue(e.target.value)}
      />
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" variant={canConfirm ? 'outline' : 'ghost'} disabled={pending || !canConfirm}>
          {pending ? 'Saving…' : isConfirmed ? (isDirty ? 'Reconfirm' : 'Confirmed') : 'Confirm'}
        </Button>
        {!isConfirmed && <span className="text-xs font-medium text-muted-foreground tabular-nums">+{POINTS} pts</span>}
      </div>
      <Label className="block text-xs font-normal text-muted-foreground">
        Pre-filled from your resume — correct anything that&apos;s off. Add a second industry if you
        span two (e.g. a recent pivot).
      </Label>
    </form>
  )
}
