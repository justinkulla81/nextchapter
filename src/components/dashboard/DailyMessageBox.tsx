'use client'

import { useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { dismissDailyMessageBox, markWelcomeVideoWatched } from '@/app/dashboard/actions'
import type { PageContentView, PageKey } from '@/lib/dashboard/page-content'
import { VideoEmbed } from '@/components/dashboard/VideoEmbed'

const WELCOME_VIDEO_URL = 'https://uvoulytrsrxasqzutlmq.supabase.co/storage/v1/object/public/site-media/victoria-how-it-works.mp4'

// Admin-authored bullets are plain strings, but a bullet can embed a real
// dashboard link with markdown-style `[label](/dashboard/...)` syntax —
// this is the only formatting bullets support, kept minimal on purpose.
function renderBulletText(bullet: string): ReactNode[] {
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g
  const parts: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = linkPattern.exec(bullet))) {
    if (match.index > lastIndex) parts.push(bullet.slice(lastIndex, match.index))
    parts.push(
      <Link key={key++} href={match[2]} className="font-medium text-brand underline underline-offset-2 hover:no-underline">
        {match[1]}
      </Link>,
    )
    lastIndex = linkPattern.lastIndex
  }
  if (lastIndex < bullet.length) parts.push(bullet.slice(lastIndex))
  return parts
}

// Server-backed message rotation, scoped per page: a pinned message shows
// first for every candidate until dismissed, then whichever active,
// non-pinned message they haven't dismissed yet takes its place (see
// getPageBoxContent). Dismissal is a real DB record, not localStorage, so
// it's the same across devices and lets an admin-authored rotation work.
// Dismissing only lasts through the rest of the day — this box reappears
// tomorrow (see dismissDailyMessageBox).
export function DailyMessageBox({
  pageKey,
  content,
  showWelcomeVideo = false,
}: {
  pageKey: PageKey
  content: PageContentView | null
  // Dashboard-only, independent of the message rotation above — see
  // PageHeaderBoxes for why this isn't just another content.videoUrl.
  showWelcomeVideo?: boolean
}) {
  const [dismissed, setDismissed] = useState(false)
  const [, startTransition] = useTransition()

  // showWelcomeVideo comes from the server (PageHeaderBoxes) computed once
  // per page load from welcomeVideoWatchedAt — pressing play only persists
  // that flag for NEXT time; it must not also hide the video mid-playback
  // in this render, or pressing play would yank the video out from under
  // whoever just started watching it.
  const showVideo = showWelcomeVideo
  if ((!content && !showVideo) || dismissed) return null

  function dismiss() {
    setDismissed(true)
    startTransition(() => {
      dismissDailyMessageBox(pageKey)
    })
  }

  function onVideoPlay() {
    startTransition(() => {
      markWelcomeVideoWatched()
    })
  }

  return (
    <Card className="border-brand/30 bg-brand/5">
      <CardContent className="relative space-y-2">
        {content && (
          <>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss for today"
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
            <p className="pr-6 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
              Daily Message
            </p>
            <p className="text-sm font-semibold text-navy">{content.title}</p>
            {content.bullets.length > 0 && (
              <ul className="list-disc space-y-1.5 pl-4 text-sm text-foreground">
                {content.bullets.map((bullet, i) => (
                  <li key={i}>{renderBulletText(bullet)}</li>
                ))}
              </ul>
            )}
            {content.videoProvider && content.videoUrl && (
              <VideoEmbed provider={content.videoProvider} url={content.videoUrl} useInlineEmbed={content.useInlineEmbed} />
            )}
            {content.footer && <p className="text-sm font-semibold text-foreground">{content.footer}</p>}
          </>
        )}
        {showVideo && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">How NextChapter works with Victoria</p>
            <video
              controls
              preload="metadata"
              className="w-full rounded-md"
              src={WELCOME_VIDEO_URL}
              onPlay={onVideoPlay}
            >
              Your browser doesn&apos;t support embedded video.
            </video>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
