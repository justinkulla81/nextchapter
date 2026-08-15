'use client'

import { useActionState, useState } from 'react'
import { updateCurrentJobStatus } from '@/app/dashboard/privacy/actions'
import { CURRENT_JOB_STATUS_LABELS } from '@/lib/constants/onboarding'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import type { CurrentJobStatus } from '@prisma/client'

const JOB_STATUS_ORDER = Object.keys(CURRENT_JOB_STATUS_LABELS) as CurrentJobStatus[]

export function CurrentJobStatusSelector({ current }: { current: CurrentJobStatus | null }) {
  const [state, formAction, pending] = useActionState(updateCurrentJobStatus, undefined)
  const [selected, setSelected] = useState<CurrentJobStatus>(current ?? JOB_STATUS_ORDER[0])

  return (
    <form action={formAction} className={cn('space-y-2', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <div className="flex flex-wrap items-center gap-2">
        <select
          name="currentJobStatus"
          value={selected}
          onChange={(e) => setSelected(e.target.value as CurrentJobStatus)}
          aria-label="Your current situation"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        >
          {JOB_STATUS_ORDER.map((status) => (
            <option key={status} value={status}>
              {CURRENT_JOB_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <SubmitButton size="sm" variant="outline" disabled={selected === current}>
          Save
        </SubmitButton>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  )
}
