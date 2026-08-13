'use client'

import { useState } from 'react'
import type { Podcast } from '@prisma/client'
import { Mic } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { ContentLikeButton } from '@/components/dashboard/ContentLikeButton'
import { ContentDislikeButton } from '@/components/dashboard/ContentDislikeButton'
import { VideoPlayerModal } from '@/components/dashboard/VideoPlayerModal'
import { logContentClickAction } from '@/app/dashboard/webinars/actions'
import { extractYouTubeVideoId } from '@/lib/content/youtube-video-id'

// Placeholder text/outline link-out buttons, NOT the official Apple
// Podcasts / Spotify badge images — this build has no image-download
// tooling to fetch and bundle the real official badge assets, and
// hand-drawing a recreation of those logos would be exactly the kind of
// custom-logo-recreation to avoid. Follow-up: swap these for the real
// official badge images (or confirm plain text links are fine as final)
// once the user supplies them.
export function PodcastCard({ podcast, isLiked }: { podcast: Podcast; isLiked: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const youtubeVideoId = podcast.youtubeUrl ? extractYouTubeVideoId(podcast.youtubeUrl) : null
  return (
    <div className="w-72 shrink-0 space-y-2 rounded-lg border border-border bg-card p-3">
      <div className="aspect-square w-full overflow-hidden rounded-md bg-muted">
        {podcast.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external podcast artwork; no remote-image domain is configured for next/image
          <img src={podcast.thumbnailUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <Mic className="size-8" aria-hidden />
          </div>
        )}
      </div>
      <div>
        <p className="line-clamp-2 text-sm font-medium text-foreground">{podcast.title}</p>
        {podcast.description && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{podcast.description}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {podcast.appleUrl && (
          <a
            href={podcast.appleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline', size: 'xs' })}
          >
            Listen on Apple Podcasts
          </a>
        )}
        {podcast.spotifyUrl && (
          <a
            href={podcast.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline', size: 'xs' })}
          >
            Listen on Spotify
          </a>
        )}
        {podcast.youtubeUrl &&
          (youtubeVideoId ? (
            <button
              type="button"
              onClick={() => {
                setIsPlaying(true)
                // Fire-and-forget — the video must open immediately regardless
                // of this call's latency, see logContentClickAction's own comment.
                void logContentClickAction('PODCAST', podcast.id)
              }}
              className={buttonVariants({ variant: 'outline', size: 'xs' })}
            >
              Watch on YouTube
            </button>
          ) : (
            <a
              href={podcast.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'outline', size: 'xs' })}
            >
              Watch on YouTube
            </a>
          ))}
      </div>
      <div className="flex justify-end gap-1">
        <ContentLikeButton
          contentType="PODCAST"
          contentId={podcast.id}
          title={podcast.title}
          isLiked={isLiked}
        />
        <ContentDislikeButton contentType="PODCAST" contentId={podcast.id} />
      </div>
      {youtubeVideoId && (
        <VideoPlayerModal
          open={isPlaying}
          onOpenChange={setIsPlaying}
          youtubeVideoId={youtubeVideoId}
          title={podcast.title}
          isShort={false}
        />
      )}
    </div>
  )
}
