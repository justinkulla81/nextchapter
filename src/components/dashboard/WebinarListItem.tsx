import type { Webinar } from '@prisma/client'
import { registerForWebinarAction } from '@/app/dashboard/webinars/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { buttonVariants } from '@/components/ui/button'
import { ContentLikeButton } from '@/components/dashboard/ContentLikeButton'
import { ContentDislikeButton } from '@/components/dashboard/ContentDislikeButton'

// Extracted from the Webinars section markup so the same row can also be
// used in "My Favorites" (a liked webinar resolved back to its Webinar
// row). Server component — only the Like/Dislike buttons nested inside are
// 'use client'.
export function WebinarListItem({
  webinar,
  isRegistered,
  isLiked,
}: {
  webinar: Webinar
  isRegistered: boolean
  isLiked: boolean
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-medium text-foreground">{webinar.title}</p>
          <p className="text-sm text-muted-foreground">
            Hosted by {webinar.hostLabel} ·{' '}
            {webinar.scheduledAt.toLocaleString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}{' '}
            · {webinar.durationMinutes} min
          </p>
        </div>
        {isRegistered ? (
          <span className="shrink-0 rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">
            Registered
          </span>
        ) : (
          <form action={registerForWebinarAction.bind(null, webinar.id)}>
            <SubmitButton size="sm" pendingLabel="Registering…">
              Register
            </SubmitButton>
          </form>
        )}
      </div>
      {webinar.description && <p className="text-sm text-muted-foreground">{webinar.description}</p>}
      {isRegistered &&
        (webinar.meetLink ? (
          <a
            href={webinar.meetLink}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ size: 'sm' })}
          >
            Join link
          </a>
        ) : (
          <p className="text-xs text-muted-foreground">
            Join link isn&apos;t ready yet — check back closer to the session.
          </p>
        ))}
      <div className="flex justify-end gap-1">
        <ContentLikeButton contentType="WEBINAR" contentId={webinar.id} title={webinar.title} isLiked={isLiked} />
        <ContentDislikeButton contentType="WEBINAR" contentId={webinar.id} />
      </div>
    </div>
  )
}
