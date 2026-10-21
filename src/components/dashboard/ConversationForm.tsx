'use client'

import { useActionState, useState } from 'react'
import { saveConversation, type ConversationFormState } from '@/app/dashboard/review-prep/actions'
import { ChoiceButtons } from '@/components/candidate/ChoiceButtons'
import { ActionSubmit } from '@/components/candidate/ActionSubmit'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CONVERSATION_KINDS } from '@/lib/review-prep/conversation'

export type ConversationDraft = {
  id: string
  kind: string
  scheduledFor: string
  askAmount: string
  askLevel: string
  reasons: string[]
  walkAway: string
}

export const EMPTY_DRAFT: ConversationDraft = { id: '', kind: '', scheduledFor: '', askAmount: '', askLevel: '', reasons: ['', '', ''], walkAway: '' }

// Your ask, your reasons and your walk-away for one conversation. Saved to the
// member's account only. A mistake never clears what was typed.
export function ConversationForm({ draft, suggestions }: { draft: ConversationDraft; suggestions: string[] }) {
  const [state, action] = useActionState<ConversationFormState, FormData>(saveConversation, null)
  const v = state?.values ?? draft
  const [kind, setKind] = useState<string | null>(v.kind || null)

  const label = 'text-base text-ink'
  const field = 'h-11 text-base'
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="id" value={v.id} />

      <div className="space-y-2">
        <p className={label}>What is the conversation?</p>
        <ChoiceButtons name="kind" label="What is the conversation?" options={CONVERSATION_KINDS.map((k) => ({ value: k.key, label: k.label }))} value={kind ?? ''} onChange={setKind} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="askAmount" className={label}>Your ask, dollars a year</Label>
          <Input id="askAmount" name="askAmount" inputMode="numeric" placeholder="145000" defaultValue={v.askAmount} className={field} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="askLevel" className={label}>Or a title or level</Label>
          <Input id="askLevel" name="askLevel" placeholder="Senior director" defaultValue={v.askLevel} className={field} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scheduledFor" className={label}>Date, if you have one</Label>
          <Input id="scheduledFor" name="scheduledFor" type="date" defaultValue={v.scheduledFor} className={field} />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className={label}>Your reasons: up to three results you can point to</legend>
        {[0, 1, 2].map((i) => (
          <Input key={i} name={`reason${i + 1}`} aria-label={`Reason ${i + 1}`} placeholder={suggestions[i] ?? 'A result, with a number if you can'} defaultValue={v.reasons[i] ?? ''} className={field} />
        ))}
        {suggestions.length > 0 && <p className="max-w-2xl text-base text-muted-foreground">From your case above: {suggestions.join('; ')}.</p>}
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="walkAway" className={label}>Your walk-away: what you will do if the answer is no</Label>
        <Textarea id="walkAway" name="walkAway" rows={3} defaultValue={v.walkAway} className="text-base" />
      </div>

      {state?.error && (
        <p role="alert" className="text-base text-destructive">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-base font-medium text-ink">
          Saved. It is in your plan if you set a date.
        </p>
      )}

      <ActionSubmit variant="secondary" pendingLabel="Saving">
        {v.id ? 'Save changes' : 'Save my ask'}
      </ActionSubmit>
    </form>
  )
}
