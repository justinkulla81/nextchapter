'use client'

import { useState } from 'react'
import { posthog } from '@/lib/posthog/client'

// Copies (or hands to the phone's share sheet) the link to this job's page, so a result can be sent to a friend or a group chat.
export function AiJobCheckShare({ soc6, title, path }: { soc6: string; title: string; path: string }) {
  const [copied, setCopied] = useState(false)

  async function share() {
    const url = `${window.location.origin}${path}`
    let method: 'share_sheet' | 'copy' = 'copy'
    try {
      if (typeof navigator.share === 'function') {
        method = 'share_sheet'
        await navigator.share({ title: `AI exposure for ${title}`, url })
      } else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      }
      posthog.capture('ai_job_check_shared', { soc6, method })
    } catch {
      // The visitor closed the share sheet, or the browser blocked the clipboard: nothing to report.
    }
  }

  return (
    <button type="button" onClick={share} className="text-sm font-medium text-brand underline underline-offset-4">
      {copied ? 'Link copied' : 'Share this result'}
    </button>
  )
}
