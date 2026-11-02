'use client'

import { useState } from 'react'
import { usePostHog } from '@/lib/posthog/client'

// The copy-paste embed code on /data/layoffs/[state]: the snippet, a select-all box and a copy button that records which widget and state were copied.
export function CopyEmbed({ widget, target, snippet }: { widget: string; target: string; snippet: string }) {
  const posthog = usePostHog()
  const [copied, setCopied] = useState(false)
  async function copy() {
    posthog?.capture('embed_snippet_copied', { widget, target, source: 'data_state_page' })
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: the box is still selectable.
    }
  }
  return (
    <div>
      <textarea readOnly value={snippet} rows={5} className="w-full rounded-lg border border-border bg-off-white p-3 font-mono text-xs" aria-label={`Embed code for ${widget}`} onFocus={(e) => e.currentTarget.select()} />
      <button type="button" onClick={copy} className="mt-2 rounded-lg bg-action px-4 py-2 text-sm font-semibold text-action-foreground hover:brightness-95">{copied ? 'Copied' : 'Copy embed code'}</button>
    </div>
  )
}
