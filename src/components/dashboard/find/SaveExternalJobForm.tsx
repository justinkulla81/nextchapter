'use client'

import { useActionState, useEffect } from 'react'
import { saveExternalJob, type SaveExternalState } from '@/app/dashboard/find-my-job/tracker-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

/** Save a job found on any site to My jobs: address, title, company, and optionally the posting text. No fit check, no cost. */
export function SaveExternalJobForm({ onSaved }: { onSaved?: () => void }) {
  const [state, formAction, pending] = useActionState<SaveExternalState, FormData>(saveExternalJob, undefined)
  useEffect(() => {
    if (state?.ok) onSaved?.()
  }, [state, onSaved])

  return (
    <form
      action={formAction}
      onSubmit={(e) => posthog.capture('job_save_external_submitted', { withText: !!(new FormData(e.currentTarget).get('text') as string)?.trim() })}
      className={cn('space-y-3', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-1.5">
        <Label htmlFor="ext-url">Job address</Label>
        <Input id="ext-url" name="url" type="url" placeholder="https://" required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ext-title">Job title</Label>
          <Input id="ext-title" name="title" required maxLength={300} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ext-company">Company</Label>
          <Input id="ext-company" name="company" maxLength={200} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ext-text">Job description (optional)</Label>
        <Textarea id="ext-text" name="text" rows={4} placeholder="Paste it to see which of its keywords your resume shows." />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.ok && <p className="text-sm text-muted-foreground" role="status">Saved to My jobs.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save to My jobs'}
      </Button>
    </form>
  )
}
