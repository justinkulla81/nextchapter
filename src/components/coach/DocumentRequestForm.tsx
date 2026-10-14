'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { requestDocument } from '@/app/support/coach/(app)/clients/[token]/[clientId]/documents/actions'

export function DocumentRequestForm({ token, clientId }: { token: string; clientId: string }) {
  const [state, action] = useActionState(requestDocument.bind(null, token, clientId), undefined)
  return (
    <form action={action} className="space-y-3">
      <Label className="block space-y-1">
        <span className="text-sm font-medium text-foreground">What do you need?</span>
        <Input name="title" required maxLength={150} placeholder="For example: Signed offer letter" />
      </Label>
      <Label className="block space-y-1">
        <span className="text-sm font-medium text-foreground">Instructions (optional)</span>
        <Textarea name="instructions" rows={3} maxLength={2000} placeholder="Anything they should know, like which version or what to black out." />
      </Label>
      <Label className="block space-y-1">
        <span className="text-sm font-medium text-foreground">Due date (optional)</span>
        <Input type="date" name="dueAt" className="w-48" />
      </Label>
      <SubmitButton pendingLabel="Requesting…" savedLabel="Request document">
        Request document
      </SubmitButton>
      {state?.message && (
        <p role="status" className="text-sm text-muted-foreground">
          {state.message}
        </p>
      )}
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  )
}
