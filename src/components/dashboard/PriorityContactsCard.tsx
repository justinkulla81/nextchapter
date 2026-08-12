'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Star, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ContactQuickLink } from '@/components/dashboard/ContactQuickLink'
import { cn } from '@/lib/utils'

export interface PriorityContactItem {
  id: string
  name: string
  email: string | null
  linkedinUrl: string | null
  company: string | null
  title: string | null
}

const PAGE_SIZE = 5

// Starred contacts the candidate hasn't reached out to yet — see
// toggleContactPriority in network/actions.ts for why a contact drops off
// this list (and starts showing in Needs a Follow-up instead) the moment an
// outreach is logged. Starring itself happens on the Contact Book, not
// here — this card is a reminder, not a management surface. Paginated at 5
// per page (matching the CONTACT_PRIORITIZED points target) rather than
// dumping the whole starred list at once — a candidate with dozens of
// starred contacts would otherwise turn this into an unscannable wall.
export function PriorityContactsCard({ contacts }: { contacts: PriorityContactItem[] }) {
  const [page, setPage] = useState(0)
  if (contacts.length === 0) return null

  const pageCount = Math.ceil(contacts.length / PAGE_SIZE)
  const visible = contacts.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  return (
    <Card id="priority-contacts" className="scroll-mt-4">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-orange/15 text-orange">
            <Star className="size-3.5 fill-orange" aria-hidden />
          </span>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Priority contacts · {contacts.length} starred
          </CardTitle>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          People you&apos;ve starred as most important to reach out to.{' '}
          <Link href="/dashboard/network/contacts" className="underline hover:text-foreground">
            Manage in your Contact Book
          </Link>
          .
        </p>
      </CardHeader>
      <CardContent className="py-0">
        {visible.map((contact, i) => (
          <div
            key={contact.id}
            className={cn(
              'flex items-center justify-between gap-3 py-2.5 text-sm',
              i !== visible.length - 1 && 'border-b border-border'
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px]">
                <ContactQuickLink
                  name={contact.name}
                  email={contact.email}
                  linkedinUrl={contact.linkedinUrl}
                  className="text-[13px]"
                />
              </p>
              {(contact.title || contact.company) && (
                <p className="truncate text-xs text-muted-foreground">
                  {[contact.title, contact.company].filter(Boolean).join(' at ')}
                </p>
              )}
            </div>
          </div>
        ))}

        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-border py-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Previous page"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
              Prev
            </button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {page + 1} of {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page === pageCount - 1}
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
