'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import type { PivotActionState } from '@/app/dashboard/pivot/actions'

type Action = (prev: PivotActionState, formData: FormData) => Promise<PivotActionState>

// One small form per action on a pivot option. The button shows the busy
// cursor while the action runs, and the result (saved or what went wrong and
// what to do) appears right beside it.
export function PivotActionForm({
  action,
  fields,
  label,
  pendingLabel,
  variant = 'outline',
  ariaLabel,
}: {
  action: Action
  fields: { name: string; value: string }[]
  label: string
  pendingLabel: string
  variant?: 'default' | 'outline' | 'ghost'
  ariaLabel?: string
}) {
  const [state, formAction] = useActionState(action, undefined)
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      {fields.map((f, i) => (
        <input key={`${f.name}-${i}`} type="hidden" name={f.name} value={f.value} />
      ))}
      <SubmitButton size="sm" variant={variant} pendingLabel={pendingLabel} savedLabel={label} aria-label={ariaLabel}>
        {label}
      </SubmitButton>
      {state?.message && (
        <span role="status" className="text-xs text-muted-foreground">
          {state.message}
        </span>
      )}
      {state?.error && (
        <span role="alert" className={cn('text-xs text-destructive')}>
          {state.error}
        </span>
      )}
    </form>
  )
}
