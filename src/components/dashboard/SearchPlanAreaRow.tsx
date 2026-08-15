'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { usePostHog } from 'posthog-js/react'
import { cn } from '@/lib/utils'
import { CONFIDENCE_STYLE } from '@/lib/scoring/grade'
import type { SearchPlanArea } from '@/lib/dashboard/search-plan'

// One row per Search Plan area — same "clickable row with a colored pill"
// shape as ActivationChecklistCard's ChecklistRow, but every row here is
// always a live link (no locked/complete state — this card is a durable
// hub, not a progressive checklist). Client-only for the click event.
export function SearchPlanAreaRow({ area }: { area: SearchPlanArea }) {
  const posthog = usePostHog()

  return (
    <Link
      href={area.href}
      onClick={() => posthog?.capture('search_plan_area_clicked', { area: area.area })}
      className="flex items-start justify-between gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-border hover:bg-muted/40"
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{area.label}</span>
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', CONFIDENCE_STYLE[area.tier])}>
            {area.progressLabel}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{area.whyItMatters}</p>
      </div>
      <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  )
}
