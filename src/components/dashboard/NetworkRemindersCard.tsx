'use client'

import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'
import { Star } from 'lucide-react'
import type { EmailReminder } from '@/lib/network/reminders'

// Links straight into the rotating reach-out cards on the Network page,
// pre-selecting the exact person the reminder is about — starring someone
// there is what puts them on this list in the first place (see
// getEmailReminders), so clicking through should land on that same person,
// not a generic contact list.
export function NetworkRemindersCard({ reminders }: { reminders: EmailReminder[] }) {
  const posthog = usePostHog()

  if (reminders.length === 0) return null

  return (
    <div className="space-y-2 rounded-lg border border-orange/30 bg-orange/5 p-4">
      <div className="flex items-center gap-1.5">
        <Star className="size-4 fill-orange text-orange" />
        <h2 className="text-sm font-medium text-foreground">Reminders to email your starred contacts</h2>
      </div>
      <div className="space-y-1.5">
        {reminders.map((reminder) => (
          <Link
            key={reminder.contactId}
            href={`/dashboard/network?contact=${reminder.contactId}#reach-out-cards`}
            onClick={() => posthog?.capture('network_reminder_clicked', { contactId: reminder.contactId })}
            className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted"
          >
            <span className="min-w-0 truncate font-medium text-foreground">
              {reminder.name}
              {reminder.company && <span className="font-normal text-muted-foreground"> — {reminder.company}</span>}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {reminder.daysSinceLastOutreach === null
                ? "Haven't reached out yet"
                : `${reminder.daysSinceLastOutreach}d since you emailed`}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
