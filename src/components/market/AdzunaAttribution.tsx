'use client'

import posthog from 'posthog-js'
import { cn } from '@/lib/utils'

// Adzuna's API terms require crediting them as the source wherever their
// salary or vacancy data is shown. Render this next to every such number.
export function AdzunaAttribution({ surface, className }: { surface: string; className?: string }) {
  return (
    <p className={cn('text-xs text-muted-foreground', className)}>
      <a
        href="https://www.adzuna.com"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-4 hover:text-foreground"
        onClick={() => posthog.capture('adzuna_attribution_clicked', { surface })}
      >
        Data by Adzuna
      </a>
    </p>
  )
}
