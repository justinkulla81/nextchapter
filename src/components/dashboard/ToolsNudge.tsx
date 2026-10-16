'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { X } from 'lucide-react'
import { posthog } from '@/lib/posthog/client'

const SEEN = 'nc_tools_nudge_seen'
const noopSubscribe = () => () => {}

// Read once per page load, so marking it seen below doesn't hide it mid-visit.
let seenAtLoad: boolean | null = null
function seenBefore(): boolean {
  if (seenAtLoad === null) {
    try {
      seenAtLoad = !!window.localStorage.getItem(SEEN)
    } catch {
      seenAtLoad = false
    }
  }
  return seenAtLoad
}

/** One small nudge on the board, shown on one visit only, until the member confirms their tools. */
export function ToolsNudge() {
  // Read once when the page loads (false on the server): seen on an earlier visit, stay hidden.
  const seen = useSyncExternalStore(noopSubscribe, seenBefore, () => true)
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    try {
      window.localStorage.setItem(SEEN, '1')
    } catch {
      // No storage (private window): it may show again next time; harmless.
    }
  }, [])
  if (seen || hidden) return null
  return (
    <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
      <span>
        Tell us the tools you use — it takes a minute and sharpens which jobs fit.{' '}
        <a href="/dashboard/skills-assessment#tools" onClick={() => posthog.capture('tools_nudge_clicked')} className="text-primary underline underline-offset-4">
          Confirm your tools
        </a>
      </span>
      <button type="button" aria-label="Hide this tip" onClick={() => setHidden(true)} className="rounded-full p-1 hover:bg-muted">
        <X className="size-3.5" aria-hidden />
      </button>
    </p>
  )
}
