'use client'

import { useActionState } from 'react'
import { importConnectionsCsv } from '@/app/dashboard/network/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function CsvImportForm() {
  const [state, formAction, pending] = useActionState(importConnectionsCsv, undefined)

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
            ? `Added ${state.imported} new connection${state.imported === 1 ? '' : 's'} — sort them into categories below.`
            : "No new connections in that file — you've already added everyone in it."}
        </p>
      )}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? 'Importing…' : 'Import LinkedIn connections'}
      </Button>
    </form>
  )
}
