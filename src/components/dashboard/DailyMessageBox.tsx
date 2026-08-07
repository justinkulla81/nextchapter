'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { dismissDailyMessageBox } from '@/app/dashboard/actions'
import type { PageContentView, PageKey } from '@/lib/dashboard/page-content'
import { VideoEmbed } from '@/components/dashboard/VideoEmbed'

// Server-backed message rotation, scoped per page: a pinned message shows
// first for every candidate until dismissed, then whichever active,
// non-pinned message they haven't dismissed yet takes its place (see
// getPageBoxContent). Dismissal is a real DB record, not localStorage, so
// it's the same across devices and lets an admin-authored rotation work.
// Dismissing only lasts through the rest of the day — this box reappears
// tomorrow (see dismissDailyMessageBox).
export function DailyMessageBox({ pageKey, content }: { pageKey: PageKey; content: PageContentView | null }) {
  const [dismissed, setDismissed] = useState(false)
  const [, startTransition] = useTransition()

  if (!content || dismissed) return null

  function dismiss() {
    setDismissed(true)
    startTransition(() => {
      dismissDailyMessageBox(pageKey)
    })
  }

  return (
    <Card className="border-brand/30 bg-brand/5">
      <CardContent className="relative space-y-2">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss for today"
          className="absolute top-0 right-0 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
        <p className="pr-6 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          Daily Message
        </p>
        <h2 className="text-sm font-semibold text-navy">{content.title}</h2>
        {content.bullets.length > 0 && (
          <ul className="list-disc space-y-1.5 pl-4 text-sm text-foreground">
            {content.bullets.map((bullet, i) => (
              <li key={i}>{bullet}</li>
            ))}
          </ul>
        )}
        {content.videoProvider && content.videoUrl && (
          <VideoEmbed provider={content.videoProvider} url={content.videoUrl} useInlineEmbed={content.useInlineEmbed} />
        )}
        {content.footer && <p className="text-sm font-semibold text-foreground">{content.footer}</p>}
      </CardContent>
    </Card>
  )
}
