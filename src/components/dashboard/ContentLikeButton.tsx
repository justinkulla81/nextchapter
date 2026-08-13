'use client'

import { Heart } from 'lucide-react'
import type { ContentLikeType } from '@prisma/client'
import { toggleContentLikeAction } from '@/app/dashboard/webinars/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

// Shared Like control for all four Videos and Webinars carousels. Liking
// (first time) creates a ContentLike row and posts to the Support Network
// feed; liking again unlikes (see toggleContentLike). SubmitButton already
// gives the required busy-cursor + disabled-while-pending feedback per
// design-principles.md.
export function ContentLikeButton({
  contentType,
  contentId,
  title,
  isLiked,
}: {
  contentType: ContentLikeType
  contentId: string
  title: string
  isLiked: boolean
}) {
  return (
    <form action={toggleContentLikeAction.bind(null, contentType, contentId, title)}>
      <SubmitButton
        variant="ghost"
        size="sm"
        className={cn('h-auto gap-1.5 px-2 py-1 text-xs', isLiked && 'text-primary')}
        aria-label={isLiked ? 'Unlike' : 'Like'}
      >
        <Heart className={cn('size-3.5', isLiked && 'fill-current')} aria-hidden />
        {isLiked ? 'Liked' : 'Like'}
      </SubmitButton>
    </form>
  )
}
