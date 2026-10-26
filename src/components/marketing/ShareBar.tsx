'use client'

import { useState } from 'react'
import { posthog } from '@/lib/posthog/client'

// "Pass it on": LinkedIn, email and copy-link for a page worth sending to someone. Each click is an event with the page and
// the channel, so the admin can see which pages get shared. Plain links wherever possible, so nothing here needs a script
// to work except the copy button.
export function ShareBar({ url, title, placement, label = 'Share this' }: { url: string; title: string; placement: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const track = (channel: 'linkedin' | 'email' | 'copy') => posthog.capture('page_shared', { channel, placement, url })
  const linkedin = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
  const mailto = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${title}\n\n${url}`)}`
  const item = 'inline-flex h-10 items-center rounded-full border border-border bg-white px-4 text-sm font-medium text-ink hover:bg-muted'

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={label}>
      <span className="mr-1 text-sm text-muted-foreground">{label}</span>
      <a href={linkedin} target="_blank" rel="noopener noreferrer" onClick={() => track('linkedin')} className={item}>
        LinkedIn
      </a>
      <a href={mailto} onClick={() => track('email')} className={item}>
        Email
      </a>
      <button
        type="button"
        className={item}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          } catch {
            // Clipboard blocked: the link is in the address bar anyway.
          }
          track('copy')
        }}
      >
        {copied ? 'Link copied' : 'Copy link'}
      </button>
    </div>
  )
}
