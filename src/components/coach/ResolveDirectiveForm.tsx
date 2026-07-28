'use client'

import { useActionState } from 'react'
import { resolveSessionDirective } from '@/app/support/coach/(app)/clients/[token]/[clientId]/actions'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { CATEGORY_ORDER, CATEGORY_LABEL } from '@/lib/scoring/grade'
import { cn } from '@/lib/utils'

export function ResolveDirectiveForm({
  token,
  clientId,
  sessionId,
}: {
  token: string
  clientId: string
  sessionId: string
}) {
  const [state, formAction, pending] = useActionState(
    resolveSessionDirective.bind(null, token, clientId, sessionId),
    undefined
  )

  return (
    <form
      action={formAction}
      className={cn('mt-2 flex flex-wrap items-end gap-2', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-1">
        <Label htmlFor={`category-${sessionId}`} className="text-xs">
          Mark followed through — which category?
        </Label>
        <select
          id={`category-${sessionId}`}
          name="category"
          required
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">Choose one…</option>
          {CATEGORY_ORDER.map((key) => (
            <option key={key} value={key}>
              {CATEGORY_LABEL[key]}
            </option>
          ))}
        </select>
      </div>
      <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
        Mark resolved
      </SubmitButton>
      {state?.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  )
}
