'use client'

import { useActionState } from 'react'
import { submitEncouragementNote } from '@/app/dashboard/community/actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { SubmitButton } from '@/components/ui/submit-button'
import { ActionSubmit } from '@/components/candidate/ActionSubmit'

// Deliberately one simple box: a note and a "reveal my name" checkbox, sent
// to a random struggling member — the giver never picks who.
export function SendEncouragementForm({ redesign = false }: { redesign?: boolean } = {}) {
  const [state, formAction] = useActionState(submitEncouragementNote, undefined)

  if (state?.sent) {
    if (redesign) return <p role="status" className="text-base text-ink">Sent. Someone here will see it when they need it most.</p>
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-foreground">Sent — someone here will see it when they need it most.</p>
        </CardContent>
      </Card>
    )
  }

  // The redesign: a labelled box and one button that says what it does. No card, no grey title.
  if (redesign) {
    return (
      <form action={formAction} className="space-y-3">
        <div className="space-y-2">
          <label htmlFor="encouragement" className="block text-base font-semibold text-ink">
            A short note for someone having a hard week
          </label>
          <p className="text-sm text-muted-foreground">It goes to a member we choose, so you never pick who. Add your name if you would like them to know it is you.</p>
          <textarea id="encouragement" name="message" required rows={3} className="w-full rounded-xl border border-border bg-white p-3.5 text-base text-ink placeholder:text-muted-foreground focus:border-ink focus:outline-none" />
        </div>
        <label className="flex items-center gap-2 text-base text-ink">
          <Checkbox name="revealSender" value="on" />
          Include my name
        </label>
        {state?.error && (
          <p role="alert" className="text-base text-destructive">
            {state.error}
          </p>
        )}
        <ActionSubmit variant="secondary" pendingLabel="Sending…" event="encouragement_sent" props={{ source: 'community' }}>
          Send encouragement
        </ActionSubmit>
      </form>
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
