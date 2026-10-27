'use client'

import { CopyButton } from '@/components/ui/copy-button'
import { usePostHog } from '@/lib/posthog/client'

/** One piece of kit text with a Copy button; the copy is counted per board and per piece. */
export function CopyBlock({ title, note, text, kind, orgId, block }: { title: string; note: string; text: string; kind: string; orgId: string; block: string }) {
  const posthog = usePostHog()
  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold text-navy">{title}</h3>
        <CopyButton text={text} label={`Copy ${title}`} onCopy={() => posthog?.capture('org_kit_copied', { kind, orgId, block })} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-off-white p-3 font-sans text-sm text-foreground">{text}</pre>
    </div>
  )
}
