'use client'

import type { ReactNode } from 'react'
import { posthog } from '@/lib/posthog/client'

/** A collapsed reference section on Home (this week’s plan, your journey): closed until the member opens it. */
export function HomeFold({ title, event, children }: { title: string; event: string; children: ReactNode }) {
  return (
    <details
      className="group rounded-2xl border border-border"
      onToggle={(e) => posthog.capture(event, { open: (e.currentTarget as HTMLDetailsElement).open })}
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-base font-semibold text-ink marker:content-none">
        <span>{title}</span>
        <span className="text-sm font-medium text-muted-foreground group-open:hidden">Show</span>
        <span className="hidden text-sm font-medium text-muted-foreground group-open:inline">Hide</span>
      </summary>
      <div className="space-y-6 border-t border-border p-4">{children}</div>
    </details>
  )
}
