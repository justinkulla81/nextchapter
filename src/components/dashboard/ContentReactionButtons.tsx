'use client'

import { useState, useTransition } from 'react'
import { Heart, ThumbsDown } from 'lucide-react'
import type { ContentLikeType } from '@prisma/client'
import { toggleContentLikeAction, dislikeContentAction } from '@/app/dashboard/webinars/actions'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Combined Like/Dislike control for all four Videos and Webinars carousels.
// Replaces the old separate ContentLikeButton/ContentDislikeButton
// (form-action based, which only updated after a full revalidatePath round
// trip — felt slow and didn't hide the Dislike button on Like). This one
// manages reaction state locally and updates instantly on click; the server
// action still runs in the background via startTransition so the mutation
// and PostHog event still happen, just without blocking the UI on it.
//
// Liking hides the Dislike button (mutually exclusive — see toggleContentLike
// in content-likes.ts, which un-dislikes on like server-side too).
// Disliking calls onDislike so the parent card can remove the whole tile —
// disliking is one-directional (see dislikeContent), so the card
// disappearing IS the confirmation; no separate "Disliked" button state.
export function ContentReactionButtons({
  contentType,
  contentId,
  title,
  isLiked,
  onDislike,
}: {
  contentType: ContentLikeType
  contentId: string
  title: string
  isLiked: boolean
  onDislike: () => void
}) {
  const [liked, setLiked] = useState(isLiked)
  const [, startTransition] = useTransition()

  function handleLike() {
    setLiked((prev) => !prev)
    startTransition(() => {
      toggleContentLikeAction(contentType, contentId, title)
    })
  }

  function handleDislike() {
    onDislike()
    startTransition(() => {
      dislikeContentAction(contentType, contentId)
    })
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={handleLike}
        className={cn('h-auto px-1.5 py-1', liked && 'text-primary')}
        aria-label={liked ? 'Unlike' : 'Like'}
      >
        <Heart className={cn('size-3.5', liked && 'fill-current')} aria-hidden />
        {liked ? 'Liked' : 'Like'}
      </Button>
      {!liked && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={handleDislike}
          className="h-auto px-1.5 py-1 text-muted-foreground"
          aria-label="Dislike — don't show this again"
        >
          <ThumbsDown className="size-3.5" aria-hidden />
          Dislike
        </Button>
      )}
    </div>
  )
}
