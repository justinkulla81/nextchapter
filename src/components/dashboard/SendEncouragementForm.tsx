'use client'

import { useActionState } from 'react'
import { submitEncouragementNote } from '@/app/dashboard/community/actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { SubmitButton } from '@/components/ui/submit-button'

// Deliberately one simple box: a note and a "reveal my name" checkbox, sent
// to a random struggling member — the giver never picks who.
export function SendEncouragementForm() {
  const [state, formAction] = useActionState(submitEncouragementNote, undefined)

  if (state?.sent) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-foreground">Sent — someone here will see it when they need it most.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Send encouragement</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-3">
          <textarea
            name="message"
            required
            rows={3}
            placeholder="A short note for someone here who's having a hard week..."
            className="w-full rounded-lg border border-border bg-white p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none"
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox name="revealSender" value="on" />
            Include my name
          </label>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <SubmitButton>Send</SubmitButton>
        </form>
      </CardContent>
    </Card>
  )
}
