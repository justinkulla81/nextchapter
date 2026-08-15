'use client'

import { useActionState } from 'react'
import { logCoachSession } from '@/app/support/coach/(app)/clients/[token]/[clientId]/actions'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import { COACH_SESSION_TYPES, COACH_SESSION_TYPE_LABELS } from '@/lib/constants/coach-session-type'
import { DimensionField } from '@/components/coach/DimensionField'
import { SESSION_DIMENSIONS } from '@/lib/coach/session-dimensions'

export function LogSessionForm({ token, clientId }: { token: string; clientId: string }) {
  const [state, formAction, pending] = useActionState(logCoachSession.bind(null, token, clientId), undefined)

  return (
    <form
      action={formAction}
      className={cn('space-y-3', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-2">
        <Label htmlFor="sessionType">Session type</Label>
        <select
          id="sessionType"
          name="sessionType"
          defaultValue="STANDARD"
          className="h-9 w-full max-w-64 rounded-md border border-input bg-background px-3 text-sm"
        >
          {COACH_SESSION_TYPES.map((type) => (
            <option key={type} value={type}>
              {COACH_SESSION_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">Sets which rate-card rate this session pays.</p>
      </div>
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
        <p className="text-xs text-muted-foreground">
          Each line becomes its own item on the client&apos;s Search Action Plan.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="focusNote">Focus for next session (shown to you at the top of your next brief)</Label>
        <Textarea id="focusNote" name="focusNote" rows={2} />
      </div>

      <div className="space-y-3 border-t border-border pt-3">
        <div>
          <p className="text-sm font-medium text-foreground">Structured session tracking</p>
          <p className="text-xs text-muted-foreground">
            Seven dimensions, optional per session — what gets tracked feeds the trend line and next
            pre-session brief. Skip any dimension you didn&apos;t cover.
          </p>
        </div>
        {SESSION_DIMENSIONS.map((key) => (
          <DimensionField key={key} dimensionKey={key} />
        ))}
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton variant="outline" pendingLabel="Saving…">
        Log this session
      </SubmitButton>
    </form>
  )
}
