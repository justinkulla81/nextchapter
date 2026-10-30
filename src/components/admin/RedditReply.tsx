'use client'

import { useEffect, useState } from 'react'
import { posthog } from '@/lib/posthog/client'

// A ready reply to copy, and a box to tick once it is posted. The tick is remembered in this browser only; the copy is an event
// with the employer, so the admin can see which replies were used.
export function RedditReply({ id, employer, text }: { id: string; employer: string; text: string }) {
  const [copied, setCopied] = useState(false)
  const [done, setDone] = useState(false)
  const storageKey = `reddit-done:${id}`

  useEffect(() => {
    try { setDone(localStorage.getItem(storageKey) === '1') } catch { /* private window: the box just starts unticked */ }
  }, [storageKey])

  return (
    <div className="mt-2">
      <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs leading-relaxed">{text}</pre>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="inline-flex h-8 items-center rounded-full border border-border bg-white px-4 text-xs font-medium hover:bg-muted"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            } catch { /* clipboard blocked: select the text above */ }
            posthog.capture('reddit_reply_copied', { noticeId: id, employer })
          }}
        >
          {copied ? 'Copied' : 'Copy reply'}
        </button>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={done}
            onChange={(e) => {
              setDone(e.target.checked)
              try { localStorage.setItem(storageKey, e.target.checked ? '1' : '0') } catch { /* not remembered */ }
              if (e.target.checked) posthog.capture('reddit_reply_marked_posted', { noticeId: id, employer })
            }}
          />
          Posted
        </label>
      </div>
    </div>
  )
}
