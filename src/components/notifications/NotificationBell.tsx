'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { markNotificationsRead, recordNotificationClick } from '@/lib/notifications/actions'
import type { BellItem } from '@/lib/notifications/member-notifications'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

// The bell in the corner of every dashboard page. Opening it marks everything read; the list is the last 20.
export function NotificationBell({ items, unread }: { items: BellItem[]; unread: number }) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(unread)
  const [, start] = useTransition()

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) {
      posthog.capture('notification_bell_opened', { unread: count })
      if (count > 0) {
        setCount(0)
        start(() => void markNotificationsRead())
      }
    }
  }

  return (
    <div className="fixed top-3 right-4 z-40">
      <button
        type="button"
        onClick={toggle}
        aria-label={count > 0 ? `Notifications, ${count} new` : 'Notifications'}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white shadow-sm hover:bg-off-white"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        {count > 0 && <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-action px-1 text-center text-[11px] leading-5 font-semibold text-action-foreground">{count > 9 ? '9+' : count}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-white p-2 shadow-lg">
          {items.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">Nothing new. We will tell you here when a layoff, a deadline or a new match is worth a look.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    onClick={() => start(() => void recordNotificationClick(n.id, n.kind))}
                    className={cn('block rounded-xl px-3 py-2 hover:bg-off-white', n.unread && 'bg-brand/5')}
                  >
                    <span className="block text-sm font-medium text-foreground">{n.title}</span>
                    {n.body && <span className="block text-xs text-muted-foreground">{n.body}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
