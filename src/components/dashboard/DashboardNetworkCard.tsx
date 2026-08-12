'use client'

import { useState, useTransition } from 'react'
import { Bell, Star } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { gmailComposeHref } from '@/lib/email/gmail-compose-href'
import type { NeedsFollowUpItem } from '@/lib/network/needs-follow-up'
import { dismissEmailActivity } from '@/app/dashboard/email-activity/actions'
import { dismissCalendarEvent } from '@/app/dashboard/calendar-activity/actions'

const FOLLOW_UP_PREVIEW_COUNT = 2

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export interface PriorityContactPreview {
  contactId: string
  name: string
  company: string | null
  email: string | null
  linkedinUrl: string | null
}

// Combines the two "someone is waiting on you" signals that used to live in
// separate cards (Follow-ups, and the Network page's starred-contact
// reminders) into one — styled to match NeedsFollowUpCard's row treatment
// (icon-badge header, per-row action button) rather than the old link-row
// style, so the two follow-up surfaces read as the same pattern site-wide.
export function DashboardNetworkCard({
  followUps,
  priorityContact,
}: {
  followUps: NeedsFollowUpItem[]
  priorityContact: PriorityContactPreview | null
}) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  const visibleFollowUps = followUps
    .filter((item) => !dismissedIds.has(item.sourceId))
    .slice(0, FOLLOW_UP_PREVIEW_COUNT)

  if (visibleFollowUps.length === 0 && !priorityContact) return null

  function handleDismiss(item: NeedsFollowUpItem) {
    setDismissedIds((prev) => new Set(prev).add(item.sourceId))
    startTransition(() => {
      const dismiss = item.kind === 'meeting' ? dismissCalendarEvent : dismissEmailActivity
      dismiss(item.sourceId).catch(() => {
        // Server dismiss failed — the row stays gone from this session's
        // view either way; next full page load reconciles from the DB.
      })
    })
  }

  const reachOutHref = priorityContact
    ? priorityContact.email
      ? gmailComposeHref(priorityContact.email, '')
      : priorityContact.linkedinUrl
        ? priorityContact.linkedinUrl
        : `/dashboard/network?contact=${priorityContact.contactId}#reach-out-cards`
    : null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-orange/15 text-orange">
            <Bell className="size-3.5" aria-hidden />
          </span>
          <CardTitle className="text-sm font-medium text-muted-foreground">Follow-ups &amp; Networking</CardTitle>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          People and applications waiting on a reply, plus a priority contact worth reaching out to
        </p>
      </CardHeader>
      <CardContent className="py-0">
        {visibleFollowUps.map((item, i) => (
          <div
            key={item.sourceId}
            className={cn(
              'flex items-center justify-between gap-3 py-2.5 text-sm',
              (i !== visibleFollowUps.length - 1 || priorityContact) && 'border-b border-border'
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-foreground">{item.contactName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {item.kind === 'meeting' ? 'Met' : 'Emailed you'} {formatDate(item.date)} — {item.subject}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <a
                href={item.gmailHref}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                {item.kind === 'meeting' ? 'Send thank-you' : 'Reply'}
              </a>
              <button
                type="button"
                onClick={() => handleDismiss(item)}
                className="h-7 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted"
                title="Not a real person or conversation — remove from this list"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        {priorityContact && (
          <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-foreground">
                <Star className="size-3.5 shrink-0 fill-orange text-orange" aria-hidden />
                {priorityContact.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {priorityContact.company ? `Starred — ${priorityContact.company}` : 'Starred contact'}
              </p>
            </div>
            {reachOutHref && (
              <a
                href={reachOutHref}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                Reach out
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
