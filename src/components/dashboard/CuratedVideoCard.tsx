'use client'

import { useState } from 'react'
import type { CuratedVideo } from '@prisma/client'
import { Play } from 'lucide-react'
import { ContentReactionButtons } from '@/components/dashboard/ContentReactionButtons'
import { VideoPlayerModal } from '@/components/dashboard/VideoPlayerModal'
import { logContentClickAction } from '@/app/dashboard/webinars/actions'
import { cn } from '@/lib/utils'

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes)
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

// Renders both the YouTube Videos and YouTube Shorts carousels — Shorts
// (video.format === 'SHORT') get a narrower, portrait-aspect card; long-form
// gets a standard 16:9 card. Clicking opens VideoPlayerModal (a single
// on-demand embed) instead of navigating to youtube.com — the "TV viewer"
// experience — rather than embedding an iframe per-card, since a carousel
// can hold many items at once and loading that many embeds simultaneously
// would be a real perf/UX cost for no benefit over a thumbnail + click.
export function CuratedVideoCard({ video, isLiked }: { video: CuratedVideo; isLiked: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const isShort = video.format === 'SHORT'
  if (dismissed) return null
  return (
    <div
      className={cn(
        'shrink-0 overflow-hidden rounded-lg border border-border bg-card',
        isShort ? 'w-40' : 'w-72'
      )}
    >
      <button
        type="button"
        onClick={() => {
          setIsPlaying(true)
          // Fire-and-forget — the video must open immediately regardless of
          // this call's latency, see logContentClickAction's own comment.
          void logContentClickAction('CURATED_VIDEO', video.id)
        }}
        className="group block w-full text-left"
      >
        <div
          className={cn(
            'relative w-full overflow-hidden bg-muted',
            isShort ? 'aspect-[9/16]' : 'aspect-video'
          )}
        >
          {video.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- external YouTube thumbnail; no remote-image domain is configured for next/image
            <img src={video.thumbnailUrl} alt="" className="size-full object-cover" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
            <span className="flex size-11 items-center justify-center rounded-full bg-black/60 text-white opacity-90 transition-opacity group-hover:opacity-100">
              <Play className="ml-0.5 size-5 fill-current" />
            </span>
          </div>
          <span className="absolute right-1.5 bottom-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[0.7rem] font-medium text-white">
            {formatDuration(video.durationSeconds)}
          </span>
        </div>
        <div className="space-y-1 p-3 pb-1.5">
          <p className="line-clamp-2 text-sm font-medium text-foreground group-hover:text-brand">
            {video.title}
          </p>
          <p className="text-xs text-muted-foreground">{video.channelTitle}</p>
        </div>
      </button>
      <div className="px-1.5 pb-1.5">
        <ContentReactionButtons
          contentType="CURATED_VIDEO"
          contentId={video.id}
          title={video.title}
          isLiked={isLiked}
          onDislike={() => setDismissed(true)}
        />
      </div>
      <VideoPlayerModal
        open={isPlaying}
        onOpenChange={setIsPlaying}
        youtubeVideoId={video.youtubeVideoId}
        title={video.title}
        isShort={isShort}
      />
    </div>
  )
}
