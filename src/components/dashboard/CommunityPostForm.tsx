'use client'

import { useActionState, useState } from 'react'
import { createCommunityPost } from '@/app/dashboard/community/actions'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const POST_UPDATE_POINTS = estimateActionEffort({ actionType: 'ENGAGE_POST_UPDATE' }).points

// Starter phrases for the nudge chips below — clicking one drops the
// candidate straight into the middle of a sentence so the blank box never
// stares back at them. Kept to 4 to match the buttons-not-dropdown rule.
const PROMPT_CHIPS = [
  { label: 'Share a win', starter: 'This week I ' },
  { label: 'Ask for help', starter: 'I could use some advice on ' },
  { label: 'Share a job lead', starter: 'Saw an opening that might help someone here: ' },
  { label: 'Give a shoutout', starter: 'Big shoutout to ' },
] as const

export function CommunityPostForm() {
  const [state, formAction, pending] = useActionState(createCommunityPost, undefined)
  const [description, setDescription] = useState('')

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-border p-4">
      <input type="hidden" name="postType" value="UPDATE" />

      <div className="flex flex-wrap gap-2">
        {PROMPT_CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => setDescription(chip.starter)}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            {chip.label}
          </button>
        ))}
      </div>

      <Textarea
        name="description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Ask for help, offer help, share a job opening, or talk about the job you want…"
        rows={3}
        required
      />
      <Input name="externalUrl" type="url" placeholder="Link (optional)" />

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending} className={cn(pending && 'cursor-progress')}>
          {pending ? 'Posting…' : 'Post'}
        </Button>
        <span className="text-xs font-medium text-muted-foreground tabular-nums">
          +{POST_UPDATE_POINTS} pts
        </span>
      </div>
    </form>
  )
}
