'use client'

import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'
import { Bell } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
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
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-orange/15 text-orange">
            <Bell className="size-3.5" aria-hidden />
          </span>
          <CardTitle className="text-sm font-medium text-muted-foreground">Follow-ups</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="py-0">
        {items.map((item, i) => {
          const content = (
            <>
              <span className="min-w-0 truncate text-[13px] font-medium text-foreground">{item.title}</span>
              <span className="max-w-[45%] shrink-0 truncate text-xs text-orange" title={item.subtitle}>
                {item.subtitle}
              </span>
            </>
          )
          const className = cn(
            'flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:text-brand',
            i !== items.length - 1 && 'border-b border-border'
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
      </CardContent>
    </Card>
  )
}
