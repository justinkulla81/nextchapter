'use client'

import { useState, useTransition } from 'react'
import { Bell, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { NeedsFollowUpItem } from '@/lib/network/needs-follow-up'
import { dismissEmailActivity } from '@/app/dashboard/email-activity/actions'
import { dismissCalendarEvent } from '@/app/dashboard/calendar-activity/actions'

const PAGE_SIZE = 5

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Read-only nudge list, not a self-report checklist — sending the actual
// email is what earns the points (Gmail detects it automatically), so
// "Reply"/"Send thank-you" only ever links out to a Gmail compose draft,
// never a "mark done" button. The X is the escape hatch for the other
// direction: a meeting or email that got auto-detected but isn't actually a
// real networking/interview conversation — dismissEmailActivity/
// dismissCalendarEvent set dismissedAt permanently (every stat and list
// consumer across this page already filters on that field, and the
// classifier itself no longer recommends bulk/newsletter senders going
// forward — see isBulk gating in sync-gmail.ts). This is a client component
// so the row disappears the instant it's clicked instead of waiting on a
// full server round-trip. Paginated at 5 per page, same as
// PriorityContactsCard, so a long list doesn't turn into an unscannable wall.
export function NeedsFollowUpCard({ items }: { items: NeedsFollowUpItem[] }) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)
  const [, startTransition] = useTransition()

  const visibleItems = items.filter((item) => !dismissedIds.has(item.sourceId))
  if (visibleItems.length === 0) return null

  const pageCount = Math.ceil(visibleItems.length / PAGE_SIZE)
  // Clamped rather than stored in state — dismissing the last item on the
  // last page shouldn't strand the view on a now-empty page.
  const effectivePage = Math.min(page, pageCount - 1)
  const pagedItems = visibleItems.slice(effectivePage * PAGE_SIZE, effectivePage * PAGE_SIZE + PAGE_SIZE)

  function handleDismiss(item: NeedsFollowUpItem) {
    setDismissedIds((prev) => new Set(prev).add(item.sourceId))
    startTransition(() => {
      const dismiss = item.kind === 'meeting' ? dismissCalendarEvent : dismissEmailActivity
      dismiss(item.sourceId).catch(() => {
        // Server dismiss failed — the row stays gone from this session's
        // view either way (retrying would just re-show something the
        // candidate already said isn't real); next full page load will
        // reconcile from the DB if it truly didn't save.
      })
    })
  }

  return (
    <Card id="needs-follow-up" className="scroll-mt-4">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-orange/15 text-orange">
            <Bell className="size-3.5" aria-hidden />
          </span>
          <CardTitle className="text-sm font-medium text-muted-foreground">Needs a follow-up</CardTitle>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          People you&apos;ve met with or heard from who haven&apos;t gotten a thank-you or follow-up
          yet. Send one to earn the points — we&apos;ll detect it automatically.
        </p>
      </CardHeader>
      <CardContent className="py-0">
        {pagedItems.map((item, i) => (
          <div
            key={item.sourceId}
            className={cn(
              'flex items-center justify-between gap-3 py-2.5 text-sm',
              i !== pagedItems.length - 1 && 'border-b border-border'
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-foreground">{item.contactName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {item.kind === 'meeting'
                  ? 'Met'
                  : item.kind === 'inbound-email'
                    ? 'Emailed you'
                    : 'You emailed, no reply yet'}{' '}
                {formatDate(item.date)} — {item.subject}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <a
                href={item.gmailHref}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                {item.kind === 'meeting' ? 'Send thank-you' : item.kind === 'inbound-email' ? 'Reply' : 'Follow up'}
              </a>
              <button
                type="button"
                onClick={() => handleDismiss(item)}
                className="h-7 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted"
                title="Not a real person or conversation — remove from this list and your stats for good"
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-border py-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={effectivePage === 0}
              aria-label="Previous page"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
              Prev
            </button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {effectivePage + 1} of {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={effectivePage === pageCount - 1}
              aria-label="Next page"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
            >
              Next
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
