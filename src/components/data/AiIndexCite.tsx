'use client'

import { CopyButton } from '@/components/ui/copy-button'
import { posthog } from '@/lib/posthog/client'

// The citation line for the AI Jobs Index with a copy button. Fires ai_jobs_index_citation_copied so a query can count how often it is taken.
export function AiIndexCite({ text, edition }: { text: string; edition: string }) {
  return (
    <div className="mt-3 flex flex-wrap items-start gap-3 rounded-lg bg-white p-3 text-sm">
      <span className="min-w-0 flex-1 select-all break-words">{text}</span>
      <CopyButton text={text} label="Copy the citation" onCopy={() => posthog.capture('ai_jobs_index_citation_copied', { edition })} />
    </div>
  )
}
