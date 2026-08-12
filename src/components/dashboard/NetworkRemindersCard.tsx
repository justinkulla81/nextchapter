'use client'

import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'
import { Bell } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/format-relative-time'
import type { UnifiedFollowUpItem } from '@/lib/dashboard/unified-follow-ups'

const PREVIEW_COUNT = 3

// Prompt 87 point 3 — backed by getUnifiedFollowUps now, not just starred
// contacts alone (that was this card's only source before Prompt 87). An
// item's href already routes to wherever that follow-up actually lives
// (Network page anchor, a Gmail compose link, Find My Job) — this card
// just renders whatever the unified list hands it. `items` may carry more
// than PREVIEW_COUNT (the caller passes the full unified list so the total
// count is accurate) — only the first 3 render here, the rest are one tap
// away via "View all" on the standalone page.
export function NetworkRemindersCard({ items }: { items: UnifiedFollowUpItem[] }) {
  const posthog = usePostHog()

  if (items.length === 0) return null

  const visible = items.slice(0, PREVIEW_COUNT)
  const isExternal = (href: string) => href.startsWith('http')

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-orange/15 text-orange">
            <Bell className="size-3.5" aria-hidden />
          </span>
          <CardTitle className="text-sm font-medium text-muted-foreground">Follow-ups</CardTitle>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">People and applications waiting on a reply from you</p>
      </CardHeader>
      <CardContent className="py-0">
        {visible.map((item, i) => {
          const content = (
            <>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{item.title}</span>
              <span
                className="max-w-[40%] shrink-0 truncate rounded-full bg-orange/15 px-2 py-0.5 text-xs font-medium text-foreground"
                title={item.subtitle}
              >
                {item.subtitle}
              </span>
              {item.date && (
                <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                  {formatRelativeTime(item.date)}
                </span>
              )}
            </>
          )
          const className = cn(
            'flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:text-brand',
            i !== visible.length - 1 && 'border-b border-border'
          )
          const onClick = () => posthog?.capture('follow_up_reminder_clicked', { kind: item.kind, id: item.id })

          return isExternal(item.href) ? (
            <a
              key={`${item.kind}-${item.id}`}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClick}
              className={className}
            >
              {content}
            </a>
          ) : (
            <Link key={`${item.kind}-${item.id}`} href={item.href} onClick={onClick} className={className}>
              {content}
            </Link>
          )
        })}
        {items.length > PREVIEW_COUNT && (
          <div className="border-t border-border py-2.5">
            <Link
              href="/dashboard/network/follow-ups"
              onClick={() => posthog?.capture('follow_up_view_all_clicked')}
              className="text-xs font-medium text-brand hover:underline"
            >
              View all {items.length} follow-ups
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
