'use client'

import { useActionState } from 'react'
import { createCommunityPost } from '@/app/dashboard/community/actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

// The "introduce yourself" unlock gate — a real post (postType SELF_INTRO),
// not a checkbox, so it shows up in the feed like anyone else's first post.
export function SelfIntroForm() {
  const [state, formAction, pending] = useActionState(createCommunityPost, undefined)

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-border p-4">
      <input type="hidden" name="postType" value="SELF_INTRO" />
      <Textarea
        name="description"
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
