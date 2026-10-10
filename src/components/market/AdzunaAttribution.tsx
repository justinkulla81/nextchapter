'use client'

import posthog from 'posthog-js'
import { cn } from '@/lib/utils'

// Adzuna's API terms require an "Adzuna" credit of at least 116x23px,
// hyperlinked to their site, wherever their salary or vacancy data is shown.
// This badge is 24px tall and at least 116px wide. Render it next to every
// such number. (We never show Adzuna's *predicted* salaries — those would
// have to be labelled "Adzuna Jobsworth".)
export function AdzunaAttribution({ surface, className }: { surface: string; className?: string }) {
  return (
    <a
      href="https://www.adzuna.com"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Data by Adzuna (opens adzuna.com)"
      className={cn(
        'inline-flex h-6 min-w-[116px] items-center justify-center rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground hover:bg-muted',
        className
      )}
      onClick={() => posthog.capture('adzuna_attribution_clicked', { surface })}
    >
      Data by Adzuna
    </a>
  )
}
