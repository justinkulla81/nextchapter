'use client'

import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'
import { Bell } from 'lucide-react'
import type { UnifiedFollowUpItem } from '@/lib/dashboard/unified-follow-ups'

// Prompt 87 point 3 — backed by getUnifiedFollowUps now, not just starred
// contacts alone (that was this card's only source before Prompt 87). An
// item's href already routes to wherever that follow-up actually lives
// (Network page anchor, a Gmail compose link, Find My Job) — this card
// just renders whatever the unified list hands it.
export function NetworkRemindersCard({ items }: { items: UnifiedFollowUpItem[] }) {
  const posthog = usePostHog()

  if (items.length === 0) return null

  const isExternal = (href: string) => href.startsWith('http')

  return (
    <div className="space-y-2 rounded-lg border border-orange/30 bg-orange/5 p-4">
      <div className="flex items-center gap-1.5">
        <Bell className="size-4 text-orange" />
        <h2 className="text-sm font-medium text-foreground">Follow-ups</h2>
      </div>
      <div className="space-y-1.5">
        {items.map((item) => {
          const content = (
            <>
              <span className="min-w-0 truncate font-medium text-foreground">{item.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{item.subtitle}</span>
            </>
          )
          const className =
            'flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted'
          const onClick = () => posthog?.capture('follow_up_reminder_clicked', { kind: item.kind, id: item.id })

          return isExternal(item.href) ? (
            <a key={`${item.kind}-${item.id}`} href={item.href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className}>
              {content}
            </a>
          ) : (
            <Link key={`${item.kind}-${item.id}`} href={item.href} onClick={onClick} className={className}>
              {content}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
