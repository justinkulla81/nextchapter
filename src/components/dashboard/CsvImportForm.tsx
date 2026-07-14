'use client'

import { useActionState } from 'react'
import { importConnectionsCsv } from '@/app/dashboard/network/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function CsvImportForm() {
  const [state, formAction, pending] = useActionState(importConnectionsCsv, undefined)

  return (
    <form action={formAction} className="space-y-3">
      <Input name="file" type="file" accept=".csv" required disabled={pending} />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.imported !== undefined && (
        <p className="text-sm text-success">Imported {state.imported} connections — sort them into categories below.</p>
      )}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? 'Importing…' : 'Import LinkedIn connections'}
      </Button>
    </form>
  )
}
