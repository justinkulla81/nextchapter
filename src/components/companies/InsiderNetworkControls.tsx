'use client'

import { useActionState, useTransition, useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { askInsider, answerInsider, declineInsider, type ActionFormState } from '@/app/dashboard/companies/[slug]/actions'

const SUGGESTED_QUESTIONS = [
  'What does the interview loop actually look like?',
  'Who makes the final call?',
  'What tends to kill candidates here?',
]

// Prompt 4.3 — request/accept, question first. The asker only ever sees
// their own level, never the recipient's name until the request is
// answered (the recipient's identity is deliberately never fetched into
// this client component at all).
export function AskInsiderForm({
  companyId,
  insiderMemberEmploymentId,
  companyPageId,
}: {
  companyId: string
  insiderMemberEmploymentId: string
  companyPageId: string
}) {
  const boundAction = askInsider.bind(null, companyId, insiderMemberEmploymentId, companyPageId)
  const [state, formAction, pending] = useActionState<ActionFormState, FormData>(boundAction, undefined)
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Ask a question
      </Button>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">
        They&apos;ll see your question and your level — not your name. If they answer, you&apos;ll both see each other.
      </p>
      <Textarea
        name="question"
        placeholder="What does the interview loop actually look like?"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        required
        rows={3}
      />
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setQuestion(q)}
            className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            {q}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <SubmitButton pendingLabel="Sending…" size="sm" className={pending ? 'cursor-progress' : ''}>
          Send question
        </SubmitButton>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  )
}

export function AnswerInsiderRequestForm({ requestId, companyPageId }: { requestId: string; companyPageId: string }) {
  const boundAction = answerInsider.bind(null, requestId, companyPageId)
  const [state, formAction, pending] = useActionState<ActionFormState, FormData>(boundAction, undefined)
  const [declinePending, startDeclineTransition] = useTransition()

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Textarea name="answer" placeholder="Share what you know…" required rows={3} />
      <div className="flex items-center gap-2">
        <SubmitButton pendingLabel="Sending…" size="sm" className={pending ? 'cursor-progress' : ''}>
          Send answer
        </SubmitButton>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={declinePending}
          className={declinePending ? 'cursor-progress' : ''}
          onClick={() => startDeclineTransition(() => declineInsider(requestId, companyPageId))}
        >
          {declinePending ? 'Declining…' : 'Decline'}
        </Button>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  )
}
