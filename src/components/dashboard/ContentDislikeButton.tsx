'use client'

import { ThumbsDown } from 'lucide-react'
import type { ContentLikeType } from '@prisma/client'
import { dislikeContentAction } from '@/app/dashboard/webinars/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

// Shared Dislike control for all four Videos and Webinars carousels, mirrors
// ContentLikeButton's structure. One-directional — no "undo my dislike" UI
// (matches the user's own casual phrasing for this ask). Disliking un-likes
// the item (see dislikeContent) and, for CURATED_VIDEO/Shorts and Podcasts,
// removes it from this candidate's future carousel queries entirely (see
// getCarouselVideos / getCarouselPodcasts) — so after revalidation the
// item's own disappearance from the carousel IS the success feedback; no
// separate "Disliked" state is needed on the button itself. SubmitButton
// already gives the required busy-cursor + disabled-while-pending feedback
// per design-principles.md.
export function ContentDislikeButton({
  contentType,
  contentId,
}: {
  contentType: ContentLikeType
  contentId: string
}) {
  return (
    <form action={dislikeContentAction.bind(null, contentType, contentId)}>
      <SubmitButton
        variant="ghost"
        size="sm"
        className={cn('h-auto gap-1.5 px-2 py-1 text-xs text-muted-foreground')}
        aria-label="Not interested — don't show this again"
      >
        <ThumbsDown className="size-3.5" aria-hidden />
        Not interested
      </SubmitButton>
    </form>
  )
}
