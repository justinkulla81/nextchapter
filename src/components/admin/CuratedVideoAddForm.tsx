'use client'

import { useActionState } from 'react'
import { addCuratedVideoAction } from '@/app/support/admin/(portal)/webinars/actions'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'

// One form covers both Videos and Shorts — format (LONG_FORM vs. SHORT) is
// derived automatically from the fetched duration (see
// src/lib/content/youtube-ingest.ts's formatFromDuration), so the admin
// never has to pick it.
export function CuratedVideoAddForm({ youtubeConfigured }: { youtubeConfigured: boolean }) {
  const [state, formAction] = useActionState(addCuratedVideoAction, undefined)

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-border p-4">
      <p className="text-sm font-medium text-foreground">Add a video or Short</p>
      <div className="space-y-1">
        <label htmlFor="videoIdOrUrl" className="text-xs font-medium text-muted-foreground">
          YouTube URL or video ID
        </label>
        <Input
          id="videoIdOrUrl"
          name="videoIdOrUrl"
          placeholder="https://www.youtube.com/watch?v=... or the 11-character video ID"
          required
        />
      </div>
      {!youtubeConfigured && (
        <>
          <p className="text-xs text-muted-foreground">
            YOUTUBE_API_KEY isn&apos;t configured yet, so title/thumbnail can&apos;t be fetched
            automatically — enter them below. This is filed as Video (long-form) by default since
            there&apos;s no duration signal without the API; remove and re-add once the key lands
            if this one&apos;s actually a Short.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="title" className="text-xs font-medium text-muted-foreground">
                Title
              </label>
              <Input id="title" name="title" />
            </div>
            <div className="space-y-1">
              <label htmlFor="thumbnailUrl" className="text-xs font-medium text-muted-foreground">
                Thumbnail URL
              </label>
              <Input id="thumbnailUrl" name="thumbnailUrl" />
            </div>
          </div>
        </>
      )}
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Adding…">Add video</SubmitButton>
    </form>
  )
}
