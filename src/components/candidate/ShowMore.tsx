'use client'

import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { posthog } from '@/lib/posthog/client'

// The rest of a page, one tap away. Nothing is deleted: everything that used to sit on the page lives in here.
export function ShowMore({ page, label = 'Show more', children }: { page: string; label?: string; children: ReactNode }) {
  return (
    <details
      className="group space-y-6"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) posthog.capture('show_more_opened', { page })
      }}
    >
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-brand underline underline-offset-4 [&::-webkit-details-marker]:hidden">
        {label}
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-8 pt-4">{children}</div>
    </details>
  )
}
