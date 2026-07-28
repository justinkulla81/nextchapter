'use client'

import { useActionState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { addSourcedCandidate } from '@/app/recruiters/(app)/candidates/actions'

export function AddSourcedCandidateForm() {
  const [state, formAction] = useActionState(addSourcedCandidate, undefined)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.added) formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="space-y-3 rounded-lg border border-border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Their name</Label>
          <Input id="name" name="name" required placeholder="Jane Doe" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Their email</Label>
          <Input id="email" name="email" type="email" required placeholder="candidate@example.com" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" name="notes" placeholder="How you know them, what roles they're a fit for…" />
      </div>
      <SubmitButton pendingLabel="Adding…">Add to my candidate book</SubmitButton>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.added && <p className="text-sm text-brand">Added.</p>}
    </form>
  )
}
