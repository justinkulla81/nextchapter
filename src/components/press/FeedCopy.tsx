'use client'

import { useState } from 'react'
import { posthog } from '@/lib/posthog/client'

// Copies a feed address. Each press is an event with the feed, so the admin can see which feeds people subscribe to.
export function FeedCopy({ url, feedKey }: { url: string; feedKey: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="inline-flex h-8 shrink-0 items-center rounded-full border border-border bg-white px-3 text-xs font-medium text-ink hover:bg-muted"
      aria-label={`Copy the feed address for ${feedKey}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          // Clipboard blocked: the address is a link on the page.
        }
        posthog.capture('feed_url_copied', { feedKey, url })
      }}
    >
      {copied ? 'Copied' : 'Copy address'}
    </button>
  )
}
