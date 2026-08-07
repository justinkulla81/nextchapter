import type { SupportNetworkContact } from '@prisma/client'
import { pickDailyContact } from '@/lib/network/pick-daily-contact'

// The page's one primary action: do something with a real contact from
// your list, right now — not a stat to read, an action to take. Working
// within real schema constraints: SupportNetworkContact has no phone field,
// and email is usually null on CSV-imported rows (LinkedIn privacy-gates
// that column), so "schedule a coffee chat" deep-links to Google Calendar's
// own event-creation UI (needs no new schema at all) while "email" only
// ever renders when a real address is on file.
export function NetworkQuickActionsCard({ contacts }: { contacts: SupportNetworkContact[] }) {
  if (contacts.length === 0) {
    return (
      <div className="space-y-2 rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium text-foreground">Reach out to someone</h2>
        <p className="text-sm text-muted-foreground">
          Your networking list is empty — add your LinkedIn connections to get a real person to reach
          out to here.
        </p>
        <a
          href="/dashboard/network/contacts#import"
          className="inline-flex h-9 items-center justify-center rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand/90"
        >
          Add your first contacts
        </a>
      </div>
    )
  }

  // pickDailyContact is guaranteed non-null here since contacts.length > 0.
  const pick = pickDailyContact(contacts)!
  const firstName = pick.name.split(' ')[0]
  const pool = contacts.filter((c) => c.warmth === 'HOT')

  const calendarUrl = new URL('https://calendar.google.com/calendar/render')
  calendarUrl.searchParams.set('action', 'TEMPLATE')
  calendarUrl.searchParams.set('text', `Coffee chat with ${pick.name}`)
  if (pick.email) calendarUrl.searchParams.set('add', pick.email)

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div>
        <h2 className="text-sm font-medium text-foreground">Reach out to {firstName}</h2>
        <p className="text-sm text-muted-foreground">
          You have {contacts.length} contact{contacts.length === 1 ? '' : 's'} saved.
          {pool.length > 0 ? ' Picked from your warmest connections.' : ''}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {pick.email ? (
          <a
            href={`mailto:${pick.email}`}
            className="inline-flex h-9 items-center justify-center rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand/90"
          >
            Email {firstName} via Gmail
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">
            No email on file for {firstName} — try a LinkedIn message, or log it below.
          </p>
        )}
        <a
          href={calendarUrl.toString()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center justify-center rounded-md border border-input px-4 text-sm font-medium text-foreground hover:bg-muted"
        >
          Schedule a coffee chat
        </a>
      </div>
      <p className="text-xs text-muted-foreground">From your networking list — see everyone below.</p>
    </div>
  )
}
