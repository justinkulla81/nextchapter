'use client'

import { useActionState } from 'react'
import { generateMonthlyReportAction } from './actions'
import { SubmitButton } from '@/components/ui/submit-button'

export function GenerateReportButton({ monthKey, label }: { monthKey: string; label: string }) {
  const [state, formAction] = useActionState(generateMonthlyReportAction, undefined)
  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <input type="hidden" name="month" value={monthKey} />
      <SubmitButton pendingLabel="Building report…">Build {label} report now</SubmitButton>
      {state?.success && <p role="status" className="text-sm text-green-700">{state.success}</p>}
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
    </form>
  )
}
