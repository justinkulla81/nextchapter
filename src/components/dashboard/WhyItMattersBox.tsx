'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { dismissWhyItMattersBox } from '@/app/dashboard/actions'
import type { PageContentView, PageKey } from '@/lib/dashboard/page-content'
import { VideoEmbed } from '@/components/dashboard/VideoEmbed'

// Unlike the Daily Message box, dismissing this is permanent — once a
// candidate has internalized why a page matters, it stays gone (see
// dismissWhyItMattersBox). It can be turned back on from
// /dashboard/privacy's "Page tips" section if they change their mind.
export function WhyItMattersBox({ pageKey, content }: { pageKey: PageKey; content: PageContentView | null }) {
  const [dismissed, setDismissed] = useState(false)
  const [, startTransition] = useTransition()

  if (!content || dismissed) return null

  function dismiss() {
    setDismissed(true)
    startTransition(() => {
      dismissWhyItMattersBox(pageKey)
    })
  }

  return (
    <Card className="border-orange/30 bg-orange/5">
      <CardContent className="relative space-y-2">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Got it, don't show this again"
          className="absolute top-0 right-0 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
        <p className="pr-6 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          Why this matters
        </p>
        <h2 className="text-sm font-semibold text-navy">{content.title}</h2>
        {content.leadIn && <p className="text-sm text-foreground">{content.leadIn}</p>}
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
