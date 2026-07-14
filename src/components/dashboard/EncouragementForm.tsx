'use client'

import { useActionState } from 'react'
import { submitEncouragementNote } from '@/app/dashboard/circle/actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

export function EncouragementForm() {
  const [state, formAction, pending] = useActionState(submitEncouragementNote, undefined)

  if (state?.sent) {
    return <p className="text-sm text-muted-foreground">Sent. Small and real — that&apos;s the whole point.</p>
  }

  return (
    <form action={formAction} className="space-y-3">
      <Textarea
        name="message"
        placeholder="A short note of support — takes 30 seconds."
        rows={3}
        maxLength={280}
      />
      <div className="flex items-center gap-2">
        <Checkbox id="revealSender" name="revealSender" value="on" />
        <Label htmlFor="revealSender" className="font-normal">
          Let them know it&apos;s from me
        </Label>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} size="sm">
        {pending ? 'Sending…' : 'Send anonymously'}
      </Button>
    </form>
  )
}
