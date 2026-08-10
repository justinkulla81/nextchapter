'use client'

import { useActionState } from 'react'
import { importConnectionsCsv } from '@/app/dashboard/network/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { cn } from '@/lib/utils'

export function CsvImportForm() {
  const [state, formAction, pending] = useActionState(importConnectionsCsv, undefined)
  const points = estimateActionEffort({ actionType: 'NETWORKING_LIST' }).points

  return (
    <form
      action={formAction}
      className={cn('space-y-3', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <Input name="file" type="file" accept=".csv" required disabled={pending} />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.imported !== undefined && (
        <p className="text-sm text-success">
          {state.imported > 0
            ? `Added ${state.imported} new connection${state.imported === 1 ? '' : 's'}`
            : 'No new connections in that file'}
          {!!state.updated && ` — filled in missing details on ${state.updated} existing contact${state.updated === 1 ? '' : 's'}`}
          {!!state.skippedRemoved && ` (${state.skippedRemoved} left off — you removed them before)`}
          .
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? 'Importing…' : 'Import LinkedIn connections'}
        </Button>
        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand tabular-nums">
          +{points} pts for new contacts
        </span>
      </div>
    </form>
  )
}
