'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Star, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { gmailComposeHref } from '@/lib/email/gmail-compose-href'
import { contactLinkType } from '@/lib/dashboard/contact-link-type'
import { toggleContactPriority } from '@/app/dashboard/network/actions'
import { cn } from '@/lib/utils'

export interface PriorityContactItem {
  id: string
  name: string
  email: string | null
  linkedinUrl: string | null
  company: string | null
  title: string | null
  // Lifetime count, not scoped to this list's "haven't reached out yet"
  // filter — normally 0 here by definition (see this card's own header
  // comment), so a nonzero value is worth surfacing on its own: either a
  // real reach-out that hasn't cleared this contact off the list yet, or a
  // sign the underlying match missed it.
  outreachCount?: number
}

const PAGE_SIZE = 5

// Starred contacts the candidate hasn't reached out to yet — see
// toggleContactPriority in network/actions.ts for why a contact drops off
// this list (and starts showing in Needs a Follow-up instead) the moment an
// outreach is logged. Starring still happens on the Contact Book; the filled
// star here is only ever an unstar action, matching the "click the star to
// remove" convention used for priority elsewhere in the app rather than an
// X (which reads as dismiss-and-forget, not "I changed my mind about this
// person mattering most"). Paginated at 5 per page (matching the
// CONTACT_PRIORITIZED points target) rather than dumping the whole starred
// list at once — a candidate with dozens of starred contacts would
// otherwise turn this into an unscannable wall.
export function PriorityContactsCard({ contacts }: { contacts: PriorityContactItem[] }) {
  const [page, setPage] = useState(0)
  const [unstarredIds, setUnstarredIds] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  const visibleContacts = contacts.filter((c) => !unstarredIds.has(c.id))
  if (visibleContacts.length === 0) return null

  function handleUnstar(contactId: string) {
    setUnstarredIds((prev) => new Set(prev).add(contactId))
    startTransition(() => {
      toggleContactPriority(contactId, false)
    })
  }

  const pageCount = Math.ceil(visibleContacts.length / PAGE_SIZE)
  // Clamped rather than stored in state — unstarring the last contact on the
  // last page shouldn't strand the view on a now-empty page.
  const effectivePage = Math.min(page, pageCount - 1)
  const visible = visibleContacts.slice(effectivePage * PAGE_SIZE, effectivePage * PAGE_SIZE + PAGE_SIZE)

  return (
    <Card id="priority-contacts" className="scroll-mt-4">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-orange/15 text-orange">
            <Star className="size-3.5 fill-orange" aria-hidden />
          </span>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Priority contacts · {visibleContacts.length} starred
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
        {visible.map((contact, i) => {
          const linkType = contactLinkType(contact)
          const messageHref =
            linkType === 'email'
              ? gmailComposeHref(contact.email!, '')
              : linkType === 'linkedin'
                ? contact.linkedinUrl!
                : null

          return (
            <div
              key={contact.id}
              className={cn(
                'flex items-center justify-between gap-3 py-2.5 text-sm',
                i !== visible.length - 1 && 'border-b border-border'
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground">{contact.name}</p>
                {(contact.title || contact.company) && (
                  <p className="truncate text-xs text-muted-foreground">
                    {[contact.title, contact.company].filter(Boolean).join(' at ')}
                  </p>
                )}
                {!!contact.outreachCount && (
                  <p className="truncate text-xs text-muted-foreground">
                    Emailed {contact.outreachCount} time{contact.outreachCount === 1 ? '' : 's'}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {messageHref && (
                  <a
                    href={messageHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    Message
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => handleUnstar(contact.id)}
                  aria-label={`Unstar ${contact.name}`}
                  title="Unstar — remove from priority contacts"
                  className="flex size-7 items-center justify-center rounded-md text-orange hover:bg-muted"
                >
                  <Star className="size-4 fill-orange" aria-hidden />
                </button>
              </div>
            </div>
          )
        })}

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
