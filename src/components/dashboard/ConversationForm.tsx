'use client'

import { useActionState, useState } from 'react'
import { saveConversation, type ConversationFormState } from '@/app/dashboard/review-prep/actions'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { SubmitButton } from '@/components/ui/submit-button'
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

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={v.id} />

      <div className="space-y-2">
        <Label>What is the conversation?</Label>
        <ChoiceButtons name="kind" options={CONVERSATION_KINDS.map((k) => ({ value: k.key, label: k.label }))} value={kind} onChange={setKind} columns={4} responsive />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="askAmount">Your ask, dollars a year</Label>
          <Input id="askAmount" name="askAmount" inputMode="numeric" placeholder="145000" defaultValue={v.askAmount} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="askLevel">Or a title or level</Label>
          <Input id="askLevel" name="askLevel" placeholder="Senior director" defaultValue={v.askLevel} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scheduledFor">Date, if you have one</Label>
          <Input id="scheduledFor" name="scheduledFor" type="date" defaultValue={v.scheduledFor} />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Your reasons: up to three results you can point to</legend>
        {[0, 1, 2].map((i) => (
          <Input key={i} name={`reason${i + 1}`} aria-label={`Reason ${i + 1}`} placeholder={suggestions[i] ?? 'A result, with a number if you can'} defaultValue={v.reasons[i] ?? ''} />
        ))}
        {suggestions.length > 0 && <p className="text-xs text-muted-foreground">From your case above: {suggestions.join('; ')}.</p>}
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="walkAway">Your walk-away: what you will do if the answer is no</Label>
        <Textarea id="walkAway" name="walkAway" rows={3} defaultValue={v.walkAway} />
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.ok && <p role="status" className="text-sm text-success">Saved. It is in your plan if you set a date.</p>}

      <SubmitButton>{v.id ? 'Save changes' : 'Save my ask'}</SubmitButton>
    </form>
  )
}
