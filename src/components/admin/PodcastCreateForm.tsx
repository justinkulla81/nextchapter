'use client'

import { useActionState } from 'react'
import { createPodcastAction } from '@/app/support/admin/(portal)/webinars/actions'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'

export function PodcastCreateForm() {
  const [state, formAction] = useActionState(createPodcastAction, undefined)

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-border p-4">
      <p className="text-sm font-medium text-foreground">Add a podcast episode</p>
      <div className="space-y-1">
        <label htmlFor="podcast-title" className="text-xs font-medium text-muted-foreground">
          Title
        </label>
        <Input id="podcast-title" name="title" required />
      </div>
      <div className="space-y-1">
        <label htmlFor="podcast-description" className="text-xs font-medium text-muted-foreground">
          Description
        </label>
        <Textarea id="podcast-description" name="description" rows={2} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="thumbnailUrl" className="text-xs font-medium text-muted-foreground">
            Thumbnail URL
          </label>
          <Input id="thumbnailUrl" name="thumbnailUrl" />
        </div>
        <div className="space-y-1">
          <label htmlFor="publishedAt" className="text-xs font-medium text-muted-foreground">
            Published date
          </label>
          <Input id="publishedAt" name="publishedAt" type="date" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Add at least one platform link — all three are optional since not every episode has all
        three.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="appleUrl" className="text-xs font-medium text-muted-foreground">
            Apple Podcasts URL
          </label>
          <Input id="appleUrl" name="appleUrl" type="url" />
        </div>
        <div className="space-y-1">
          <label htmlFor="spotifyUrl" className="text-xs font-medium text-muted-foreground">
            Spotify URL
          </label>
          <Input id="spotifyUrl" name="spotifyUrl" type="url" />
        </div>
        <div className="space-y-1">
          <label htmlFor="youtubeUrl" className="text-xs font-medium text-muted-foreground">
            YouTube URL
          </label>
          <Input id="youtubeUrl" name="youtubeUrl" type="url" />
        </div>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Adding…">Add podcast</SubmitButton>
    </form>
  )
}
