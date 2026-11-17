'use client'

import { useState } from 'react'
import { posthog } from '@/lib/posthog/client'

// Copies one line of the pitch to the clipboard and says so. The member pastes it themselves: we never send for them.
export function CopyText({ text, kind, label = 'Copy' }: { text: string; kind: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  return (
    <button
      type="button"
      aria-label={`${label}: ${kind.replace(/_/g, ' ')}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setState('copied')
          posthog.capture('pitch_copied', { kind, chars: text.length })
        } catch {
          setState('failed')
        }
        setTimeout(() => setState('idle'), 2500)
      }}
      className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted"
    >
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Select and copy it instead' : label}
    </button>
  )
}
