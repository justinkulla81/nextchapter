'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { createCommunityPost } from '@/app/dashboard/community/actions'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ActionSubmit } from '@/components/candidate/ActionSubmit'

export function CommunityPostForm() {
  const [state, formAction] = useActionState(createCommunityPost, undefined)
  const [description, setDescription] = useState('')

  // The redesign: a labelled box, a link field and one orange "Post" action. The "+N pts" tag is gone, and
  // what you typed stays put if the post is held back.
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="postType" value="UPDATE" />
      <div className="space-y-2">
        <label htmlFor="community-post-text" className="block text-base font-semibold text-ink">
          What would you like to share?
        </label>
        <p className="text-sm text-muted-foreground">Ask for help, offer help, share a job opening or talk about the job you want.</p>
        <Textarea id="community-post-text" name="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required className="text-base" />
      </div>
      <div className="space-y-2">
        <label htmlFor="community-post-link" className="block text-sm font-semibold text-ink">
          Link (optional)
        </label>
        <Input id="community-post-link" name="externalUrl" type="url" className="h-11 text-base" />
      </div>
      {state?.error && (
        <p role="alert" className="text-base text-destructive">
          {state.error}
        </p>
      )}
      {state?.notice && (
        <p role="status" className="rounded-2xl bg-muted/60 p-5 text-base text-ink">
          {state.notice}{' '}
          {state.showSupportLink && (
            <Link href="/dashboard/support" className="font-medium text-brand underline underline-offset-4">
              Talk to someone
            </Link>
          )}
        </p>
      )}
      <ActionSubmit pendingLabel="Posting…" event="community_post_submitted" props={{ postType: 'UPDATE', hasLink: false }}>
        Post to the community
      </ActionSubmit>
    </form>
  )
}
