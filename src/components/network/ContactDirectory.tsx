'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { RELATIONSHIP_TAG_OPTIONS } from '@/components/dashboard/RelationshipTagsFieldset'
import { StarContactButton } from '@/components/dashboard/StarContactButton'
import type { ContactRowData } from '@/components/dashboard/ContactDetailPanel'
import { ListRow, RowList } from '@/components/candidate/ListRow'
import { EmptyCard } from '@/components/candidate/EmptyCard'
import { ChoiceField } from '@/components/candidate/ChoiceField'
import { MEMBERSHIP_LABEL } from '@/lib/network/next-chapter-membership'
import { activeContactFilters, contactFact, contactWhy, contactsHref, CONTACT_SORT_CHOICES, type ContactListState, type ContactSortKey, type YesNoAll } from '@/lib/redesign/network-account'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

const RELATIONSHIP_LABEL: Record<string, string> = Object.fromEntries(RELATIONSHIP_TAG_OPTIONS.map((o) => [o.value, o.label]))

const YES_NO: { value: YesNoAll; label: string }[] = [
  { value: 'all', label: 'Anyone' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
]

// The redesigned "People you know" list (docs/redesign-old-card-audit-network-account.md): one row per person with
// a name, who they are, one fact and two actions. The table, its seven columns, the four dropdowns and the
// "Your employer" and "Candidate" tags it replaces are gone. Searching stays on top; filtering and sorting sit
// behind one control that says how many filters are on. Everything is a link or a form, so the address holds the state.
export function ContactDirectory({
  contacts,
  totalCount,
  page,
  pageCount,
  pageSize = 50,
  state,
  hasAnyContacts = true,
}: {
  contacts: ContactRowData[]
  totalCount: number
  page: number
  pageCount: number
  pageSize?: number
  state: ContactListState
  hasAnyContacts?: boolean
}) {
  const router = useRouter()
  const [navPending, startNav] = useTransition()
  const [searchInput, setSearchInput] = useState(state.q)

  function go(overrides: Partial<ContactListState>) {
    startNav(() => router.push(contactsHref(state, { page: 1, ...overrides })))
  }

  // Debounced so typing does not navigate on every keystroke.
  useEffect(() => {
    if (searchInput === state.q) return
    const t = setTimeout(() => {
      posthog.capture('contacts_searched', { length: searchInput.length })
      startNav(() => router.push(contactsHref(state, { q: searchInput, page: 1 })))
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const filters = activeContactFilters(state)

  return (
    <div className={cn('space-y-4', navPending && 'cursor-wait')}>
      {hasAnyContacts && (
        <div className="space-y-3">
          <div>
            <label htmlFor="contact-search" className="sr-only">
              Search your contacts
            </label>
            <input
              id="contact-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name, company or email"
              className="h-11 w-full max-w-md rounded-xl border border-border bg-white px-3.5 text-base text-ink"
            />
          </div>
          <details className="group" open={filters > 0 || undefined}>
            <summary className="inline-flex h-10 cursor-pointer list-none items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted [&::-webkit-details-marker]:hidden">
              {filters > 0 ? `Filter and sort (${filters} on)` : 'Filter and sort'}
            </summary>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <ChoiceField name="sort" label="Sort by" options={CONTACT_SORT_CHOICES} value={state.sort} onChange={(v) => go({ sort: v as ContactSortKey, dir: 'asc' })} />
              <ChoiceField
                name="pin"
                label="Starred people"
                why="Starred people are the ones you most want to write to."
                options={[
                  { value: '1', label: 'On top' },
                  { value: '0', label: 'Mixed in' },
                ]}
                value={state.pin ? '1' : '0'}
                onChange={(v) => go({ pin: v === '1' })}
              />
              <ChoiceField
                name="email"
                label="Has an email"
                options={[
                  { value: 'all', label: 'Anyone' },
                  { value: 'has', label: 'Has email' },
                  { value: 'missing', label: 'No email' },
                ]}
                value={state.email}
                onChange={(v) => go({ email: v as ContactListState['email'] })}
              />
              <ChoiceField name="reached" label="You have reached out" options={YES_NO} value={state.reached} onChange={(v) => go({ reached: v as YesNoAll })} />
              <ChoiceField name="nc" label="On NextChapter" options={YES_NO} value={state.nc} onChange={(v) => go({ nc: v as YesNoAll })} />
              <ChoiceField name="rel" label="You noted how you know them" options={YES_NO} value={state.rel} onChange={(v) => go({ rel: v as YesNoAll })} />
            </div>
          </details>
        </div>
      )}

      {contacts.length === 0 ? (
        <EmptyCard
          title={state.q || filters > 0 ? 'No one matches that' : 'No contacts yet'}
          why={state.q || filters > 0 ? 'Try a shorter search or turn a filter off. Your full list is still here.' : 'Add the people you know and we tell you who to write to first.'}
          action={
            state.q || filters > 0 ? (
              <Link href="/dashboard/network/contacts" className="text-sm font-medium text-brand underline underline-offset-4">
                Clear search and filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <RowList label="Your contacts">
          {contacts.map((c) => (
            <ListRow
              key={c.id}
              name={c.name}
              title={
                <Link href={`/dashboard/network/contacts/${c.id}`} className="hover:underline">
                  {c.name}
                </Link>
              }
              why={contactWhy({
                title: c.title,
                company: c.company,
                inferredCompany: c.inferredCompany,
                membershipLabel: c.membership ? MEMBERSHIP_LABEL[c.membership] : null,
                relationshipLabels: [...c.relationshipTags.map((t) => RELATIONSHIP_LABEL[t] ?? t), ...c.customTags],
              })}
              fact={contactFact(c)}
              actions={
                <>
                  <StarContactButton contactId={c.id} isPriority={c.isPriority} labeled />
                  <Link
                    href={`/dashboard/network/contacts/${c.id}`}
                    onClick={() => posthog.capture('contact_opened', { contactId: c.id, source: 'contacts_list' })}
                    className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted"
                  >
                    Write to them
                  </Link>
                </>
              }
            />
          ))}
        </RowList>
      )}

      {pageCount > 1 && (
        <nav aria-label="More contacts" className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            Showing {(page - 1) * pageSize + 1} to {Math.min(totalCount, page * pageSize)} of {totalCount}
          </span>
          <span className="flex items-center gap-3">
            {page > 1 && (
              <Link href={contactsHref(state, { page: page - 1 })} className="inline-flex h-10 items-center rounded-full border border-border px-5 font-medium text-ink hover:bg-muted">
                Previous
              </Link>
            )}
            <span className="tabular-nums">
              Page {page} of {pageCount}
            </span>
            {page < pageCount && (
              <Link href={contactsHref(state, { page: page + 1 })} className="inline-flex h-10 items-center rounded-full border border-border px-5 font-medium text-ink hover:bg-muted">
                Next
              </Link>
            )}
          </span>
        </nav>
      )}
    </div>
  )
}
