'use client'

import { useState } from 'react'
import type { Webinar } from '@prisma/client'
import { registerForWebinarAction } from '@/app/dashboard/webinars/actions'
import { ContentReactionButtons } from '@/components/dashboard/ContentReactionButtons'
import { ActionSubmit } from '@/components/candidate/ActionSubmit'

// Extracted from the Webinars section markup so the same row can also be
// used in "My Favorites" (a liked webinar resolved back to its Webinar
// row). Client component (needs local dismissed state for instant-hide on
// Dislike — see ContentReactionButtons).
export function WebinarListItem({
  webinar,
  isRegistered,
  isLiked,
}: {
  webinar: Webinar
  isRegistered: boolean
  isLiked: boolean
}) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  const when = webinar.scheduledAt.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  return (
    <div className="space-y-2 rounded-2xl border border-border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-64 space-y-0.5">
          <p className="text-base font-semibold text-ink">{webinar.title}</p>
          <p className="text-sm text-muted-foreground">
            Hosted by {webinar.hostLabel} · {when} · {webinar.durationMinutes} min
          </p>
          {webinar.description && <p className="text-base text-ink">{webinar.description}</p>}
        </div>
        {isRegistered ? (
          webinar.meetLink ? (
            <a href={webinar.meetLink} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted">
              Join the webinar
            </a>
          ) : null
        ) : (
          <form action={registerForWebinarAction.bind(null, webinar.id)}>
            <ActionSubmit variant="secondary" pendingLabel="Registering…" event="webinar_registered" props={{ webinarId: webinar.id, source: 'videos_more' }}>
              Register
            </ActionSubmit>
          </form>
        )}
      </div>
      {isRegistered && <p className="text-sm text-ink">{webinar.meetLink ? 'You are registered.' : 'You are registered. The join link appears here closer to the session.'}</p>}
      <ContentReactionButtons contentType="WEBINAR" contentId={webinar.id} title={webinar.title} isLiked={isLiked} onDislike={() => setDismissed(true)} />
    </div>
  )
}
