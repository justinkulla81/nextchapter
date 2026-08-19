'use client'

import type { CuratedVideo } from '@prisma/client'
import { CuratedVideoCard } from '@/components/dashboard/CuratedVideoCard'

// Shown on the Check In card, never alongside the low-sentiment help-advice
// block (see MoodCheckInCard) — that's the one moment a candidate should see
// focused support content, not a content carousel. Reuses CuratedVideoCard
// as-is (thumbnail, play-on-click modal, like/dislike) — same component the
// Videos and Webinars page's carousels already use, just a different
// category of video (see VideoCategory.MOTIVATIONAL).
export function MotivationalVideoCarousel({
  videos,
  likedVideoIds,
}: {
  videos: CuratedVideo[]
  likedVideoIds: string[]
}) {
  if (videos.length === 0) return null
  const liked = new Set(likedVideoIds)

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="text-sm font-medium text-foreground">A little perspective, while you&apos;re here</p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {videos.map((video) => (
          <CuratedVideoCard key={video.id} video={video} isLiked={liked.has(video.id)} />
        ))}
      </div>
    </div>
  )
}
