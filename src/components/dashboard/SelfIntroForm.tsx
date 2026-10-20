'use client'

import { useActionState } from 'react'
import { createCommunityPost } from '@/app/dashboard/community/actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ActionSubmit } from '@/components/candidate/ActionSubmit'

// The "introduce yourself" unlock gate — a real post (postType SELF_INTRO),
// not a checkbox, so it shows up in the feed like anyone else's first post.
export function SelfIntroForm({ defaultValue, redesign = false }: { defaultValue: string; redesign?: boolean }) {
  const [state, formAction, pending] = useActionState(createCommunityPost, undefined)

  if (redesign) {
    return (
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="postType" value="SELF_INTRO" />
        <div className="space-y-2">
          <label htmlFor="self-intro" className="block text-base font-semibold text-ink">
            Your introduction
          </label>
          <p className="text-sm text-muted-foreground">Background, what you are looking for, and what you can offer someone else here. A couple of sentences is plenty, and you can edit this draft.</p>
          <Textarea id="self-intro" name="description" defaultValue={defaultValue} rows={4} required className="text-base" />
        </div>
        {state?.error && (
          <p role="alert" className="text-base text-destructive">
            {state.error}
          </p>
        )}
        <ActionSubmit pendingLabel="Posting…" event="community_intro_posted" props={{ postType: 'SELF_INTRO' }}>
          Introduce yourself
        </ActionSubmit>
      </form>
    )
  }

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-border p-4">
      <input type="hidden" name="postType" value="SELF_INTRO" />
      <Textarea
        name="description"
        defaultValue={defaultValue}
        placeholder="Background, what you're looking for, what you can offer someone else here — a couple sentences is plenty."
        rows={4}
        required
      />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className={pending ? 'cursor-progress' : ''}>
        {pending ? 'Posting…' : 'Introduce yourself'}
      </Button>
    </form>
  )
}
