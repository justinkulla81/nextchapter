'use client'

import { useActionState } from 'react'
import { logCoachSession } from '@/app/support/coach/clients/[token]/[clientId]/actions'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

export function LogSessionForm({ token, clientId }: { token: string; clientId: string }) {
  const [state, formAction, pending] = useActionState(logCoachSession.bind(null, token, clientId), undefined)

  return (
    <form
      action={formAction}
      className={cn('space-y-3', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-2">
        <Label htmlFor="durationMinutes">Session length (minutes, optional)</Label>
        <Input id="durationMinutes" name="durationMinutes" type="number" min={1} className="max-w-32" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Your notes (private — never shown to the client)</Label>
        <Textarea id="notes" name="notes" rows={4} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="directives">Directives for the client (shown to them on their dashboard)</Label>
        <Textarea id="directives" name="directives" rows={3} />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton variant="outline" pendingLabel="Saving…">
        Log this session
      </SubmitButton>
    </form>
  )
}
