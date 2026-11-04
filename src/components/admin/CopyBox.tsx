'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { posthog } from '@/lib/posthog/client'

/** A block of text with a button that copies it, and says so when it has. */
export function CopyBox({ label, text, kind }: { label: string; text: string; kind: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
      posthog.capture('roundup_draft_copied', { kind })
    } catch {
      setState('failed')
    }
    setTimeout(() => setState('idle'), 2500)
  }
  return (
    <section className="rounded-lg border border-border bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-navy">{label}</h2>
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed: select the text instead' : 'Copy text'}
        </Button>
      </div>
      <pre className="mt-3 whitespace-pre-wrap break-words rounded-md bg-off-white p-3 text-sm leading-relaxed text-foreground">{text}</pre>
    </section>
  )
}
