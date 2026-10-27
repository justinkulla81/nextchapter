'use client'

import { useState } from 'react'
import { posthog } from '@/lib/posthog/client'

// A "copy" button for a citation or an embed snippet. Each press is an event with what was copied, so the admin can see which
// figures reporters take. A blocked clipboard leaves the text selectable in the box beside it.
export function PressCopy({ text, kind, id, label = 'Copy' }: { text: string; kind: 'cite' | 'embed'; id: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="inline-flex h-9 shrink-0 items-center rounded-full border border-border bg-white px-4 text-sm font-medium text-ink hover:bg-muted"
      onClick={async () => {
        try {
          // "{DATE}" in a citation becomes the day it is copied, so "Accessed" is never stale or blank.
          const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          await navigator.clipboard.writeText(text.replace('{DATE}', today))
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          // Clipboard blocked: the text is on the page to select.
        }
        posthog.capture(kind === 'cite' ? 'press_cite_copied' : 'press_embed_copied', { id })
      }}
    >
      {copied ? 'Copied' : label}
    </button>
  )
}
