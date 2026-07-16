'use client'

import { useActionState } from 'react'
import { createCommunityPost } from '@/app/dashboard/community/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export function CommunityPostForm() {
  const [state, formAction, pending] = useActionState(createCommunityPost, undefined)

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-border p-4">
      <input type="hidden" name="postType" value="UPDATE" />
      <Textarea
        name="description"
        placeholder="Ask for help, offer help, share a job opening, or talk about the job you want…"
        rows={3}
        required
      />
      <Input name="externalUrl" type="url" placeholder="Link (optional)" />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className={pending ? 'cursor-progress' : ''}>
        {pending ? 'Posting…' : 'Post'}
      </Button>
    </form>
  )
}
