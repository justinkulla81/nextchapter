import type { CuratedVideo } from '@prisma/client'
import { ContentLikeButton } from '@/components/dashboard/ContentLikeButton'
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
// gets a standard 16:9 card. Links out to the real watch page rather than
// embedding an iframe per-card, since a carousel can hold many items at
// once and loading that many embeds would be a real perf/UX cost for no
// benefit over a thumbnail + click-through.
export function CuratedVideoCard({ video, isLiked }: { video: CuratedVideo; isLiked: boolean }) {
  const isShort = video.format === 'SHORT'
  return (
    <div
      className={cn(
        'shrink-0 overflow-hidden rounded-lg border border-border bg-card',
        isShort ? 'w-40' : 'w-72'
      )}
    >
      <a
        href={`https://www.youtube.com/watch?v=${video.youtubeVideoId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="group block"
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
      </a>
      <div className="flex items-center justify-end px-1.5 pb-1.5">
        <ContentLikeButton
          contentType="CURATED_VIDEO"
          contentId={video.id}
          title={video.title}
          isLiked={isLiked}
        />
      </div>
    </div>
  )
}
