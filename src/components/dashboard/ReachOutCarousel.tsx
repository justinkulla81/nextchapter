'use client'

import { useState, useTransition, useEffect } from 'react'
import { usePostHog } from 'posthog-js/react'
import { Star, ChevronLeft, ChevronRight } from 'lucide-react'
import { toggleContactPriority } from '@/app/dashboard/network/actions'
import { cn } from '@/lib/utils'
import type { ReachOutPoolContact } from '@/lib/network/pick-reach-out-contacts'

// Rotating cards over the "reach out or starred" pool (see
// pickReachOutContacts) — one person at a time, with prev/next controls
// instead of a single static daily pick, so a candidate can browse the
// whole shortlist in one sitting instead of only seeing one name per day.
// initialContactId deep-links a specific person into view (used by the
// dashboard's Reminders card).
export function ReachOutCarousel({
  contacts,
  initialContactId,
}: {
  contacts: ReachOutPoolContact[]
  initialContactId?: string
}) {
  const posthog = usePostHog()
  const initialIndex = Math.max(
    0,
    contacts.findIndex((c) => c.id === initialContactId)
  )
  const [index, setIndex] = useState(initialIndex)
  const [priorityByContact, setPriorityByContact] = useState<Record<string, boolean>>({})
  const [, startTransition] = useTransition()

  // A deep link can arrive after this component already mounted with a
  // different initial index (e.g. clicking a Reminder while already on the
  // Network page) — react to it rather than only reading it once.
  useEffect(() => {
    if (!initialContactId) return
    const found = contacts.findIndex((c) => c.id === initialContactId)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (found >= 0) setIndex(found)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContactId])

  if (contacts.length === 0) {
    return (
      <div id="reach-out-cards" className="scroll-mt-4 space-y-2 rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium text-foreground">Reach out to someone</h2>
        <p className="text-sm text-muted-foreground">
          Your networking list is empty — add your LinkedIn connections to get real people to reach out to
          here.
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

  const contact = contacts[index]
  const isPriority = priorityByContact[contact.id] ?? contact.isPriority
  const firstName = contact.name.split(' ')[0]
  const roleContext = [contact.title, contact.company].filter(Boolean).join(' at ')

  const calendarUrl = new URL('https://calendar.google.com/calendar/render')
  calendarUrl.searchParams.set('action', 'TEMPLATE')
  calendarUrl.searchParams.set('text', `Coffee chat with ${contact.name}`)
  if (contact.email) calendarUrl.searchParams.set('add', contact.email)

  function go(direction: 1 | -1) {
    setIndex((i) => (i + direction + contacts.length) % contacts.length)
    posthog?.capture('reach_out_card_advanced', { direction: direction === 1 ? 'next' : 'previous' })
  }

  function toggleStar() {
    const next = !isPriority
    setPriorityByContact((prev) => ({ ...prev, [contact.id]: next }))
    startTransition(() => {
      toggleContactPriority(contact.id, next)
    })
    posthog?.capture('contact_starred', { contactId: contact.id, starred: next, source: 'reach_out_carousel' })
  }

  return (
    <div id="reach-out-cards" className="scroll-mt-4 space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-foreground">Reach out to {firstName}</h2>
          <p className="text-sm text-muted-foreground">
            {roleContext && <span className="text-foreground">{roleContext} — </span>}
            {contact.hasReachedOut ? "You've emailed before." : 'Starred as a priority contact.'}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleStar}
          aria-label={isPriority ? 'Unstar this contact' : 'Star this contact'}
          title={isPriority ? 'Unstar' : 'Star — get reminders to follow up with them'}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted"
        >
          <Star className={cn('size-5', isPriority && 'fill-orange text-orange')} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {contact.email ? (
          <a
            href={`mailto:${contact.email}`}
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

      {contacts.length > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-2">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous person"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            <ChevronLeft className="size-4" />
            Prev
          </button>
          <span className="text-xs text-muted-foreground tabular-nums">
            {index + 1} of {contacts.length}
          </span>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next person"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Next
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">From your networking list — see everyone below.</p>
    </div>
  )
}
