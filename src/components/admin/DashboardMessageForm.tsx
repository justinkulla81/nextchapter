'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/support/admin/(portal)/messages/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

export function DashboardMessageForm({
  action,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>
}) {
  const [state, formAction, pending] = useActionState(action, undefined)

  return (
    <form
      action={formAction}
      className={cn(
        'space-y-4 rounded-lg border border-border p-4',
        pending && 'cursor-progress [&_*]:cursor-progress'
      )}
    >
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required placeholder="e.g. It's okay to have a slow week" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bullets">Bullets (one per line)</Label>
        <Textarea id="bullets" name="bullets" required rows={4} placeholder={'One idea per line…'} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="footer">Closing line (optional)</Label>
        <Input id="footer" name="footer" placeholder="A short nudge shown after the bullets" />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton pendingLabel="Adding…">Add message</SubmitButton>
    </form>
  )
}
