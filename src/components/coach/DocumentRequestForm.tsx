'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { usePreservedFormAction } from '@/lib/forms/use-preserved-form'
import { requestDocument } from '@/app/support/coach/(app)/clients/[token]/[clientId]/documents/actions'

// A request that fails (for example a bad date) keeps what was typed; one that goes through clears the form.
export function DocumentRequestForm({ token, clientId }: { token: string; clientId: string }) {
  const { state, pending, formRef, onSubmit } = usePreservedFormAction(requestDocument.bind(null, token, clientId), { resetOnSuccess: true })
  return (
    <form ref={formRef} onSubmit={onSubmit} className={cn('space-y-3', pending && 'cursor-progress')}>
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
      <Button type="submit" disabled={pending} className={cn(pending && 'cursor-progress')}>
        {pending ? 'Requesting…' : 'Request document'}
      </Button>
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
