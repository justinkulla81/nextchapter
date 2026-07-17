'use client'

import { useActionState, useState } from 'react'
import { logAiProject } from '@/app/dashboard/learning/actions'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function LogAiProjectForm() {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(logAiProject, undefined)

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Log an AI project
      </Button>
    )
  }

  return (
    <form
      action={formAction}
      className={cn(
        'space-y-3 rounded-lg border border-border p-4',
        pending && 'cursor-progress [&_*]:cursor-progress'
      )}
    >
      <div className="space-y-2">
        <Label htmlFor="ai-project-title">What did you build or produce?</Label>
        <Input id="ai-project-title" name="title" required placeholder="e.g. Automated a weekly reporting workflow" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ai-project-tool">Which AI tool did you use?</Label>
        <Input id="ai-project-tool" name="toolUsed" required placeholder="e.g. Claude, ChatGPT, GitHub Copilot" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ai-project-description">
          Describe it in your own words — we&apos;ll tighten it into a proof statement for your Dossier.
        </Label>
        <Textarea id="ai-project-description" name="description" required rows={3} />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        <SubmitButton pendingLabel="Saving…">Save AI project</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
