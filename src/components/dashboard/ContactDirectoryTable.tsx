'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { SupportNetworkContact, RelationshipTag } from '@prisma/client'
import { Star } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { RelationshipTagsFieldset, RELATIONSHIP_TAG_OPTIONS } from '@/components/dashboard/RelationshipTagsFieldset'
import { updateContact, deleteContact, restoreContact, toggleContactPriority } from '@/app/dashboard/network/actions'
import { MEMBERSHIP_LABEL, type NextChapterMembership } from '@/lib/network/next-chapter-membership'
import type { ContactSortKey } from '@/app/dashboard/network/contacts/page'
import { cn } from '@/lib/utils'

const RELATIONSHIP_LABEL: Record<RelationshipTag, string> = Object.fromEntries(
  RELATIONSHIP_TAG_OPTIONS.map((o) => [o.value, o.label])
) as Record<RelationshipTag, string>

export interface ContactRowData extends SupportNetworkContact {
  hasReachedOut: boolean
  lastOutreachChannel: string | null
  membership: NextChapterMembership | null
}

function relationshipSummary(tags: RelationshipTag[]): string {
  if (tags.length === 0) return '—'
  return tags.map((t) => RELATIONSHIP_LABEL[t]).join(', ')
}

const SORTABLE_COLUMNS: { key: ContactSortKey; label: string }[] = [
  { key: 'priority', label: 'Priority' },
  { key: 'name', label: 'Name' },
  { key: 'company', label: 'Company' },
  { key: 'date', label: 'Date connected' },
]
const DISPLAY_COLUMNS = ['Relationship', 'Reached out', 'On NextChapter']

export function ContactDirectoryTable({
  contacts,
  totalCount,
  removedCount,
  page,
  pageCount,
  query,
  sortKey,
  dir,
  pin,
  emailFilter,
}: {
  contacts: ContactRowData[]
  totalCount: number
  removedCount: number
  page: number
  pageCount: number
  query: string
  sortKey: ContactSortKey
  dir: 'asc' | 'desc'
  pin: boolean
  emailFilter: 'all' | 'has' | 'missing'
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [searchInput, setSearchInput] = useState(query)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())
  const [undo, setUndo] = useState<ContactRowData | null>(null)

  function navigate(overrides: {
    q?: string
    sort?: ContactSortKey
    dir?: 'asc' | 'desc'
    pin?: boolean
    email?: 'all' | 'has' | 'missing'
    page?: number
  }) {
    const next = { q: query, sort: sortKey, dir, pin, email: emailFilter, page, ...overrides }
    const params = new URLSearchParams()
    if (next.q) params.set('q', next.q)
    if (next.sort !== 'name') params.set('sort', next.sort)
    if (next.dir !== 'asc') params.set('dir', next.dir)
    if (!next.pin) params.set('pin', '0')
    if (next.email !== 'all') params.set('email', next.email)
    if (next.page !== 1) params.set('page', String(next.page))
    const qs = params.toString()
    router.push(`/dashboard/network/contacts${qs ? `?${qs}` : ''}`)
  }

  // Debounced so typing doesn't fire a navigation per keystroke.
  useEffect(() => {
    if (searchInput === query) return
    const t = setTimeout(() => navigate({ q: searchInput, page: 1 }), 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  function toggleSort(key: ContactSortKey) {
    if (sortKey === key) navigate({ dir: dir === 'asc' ? 'desc' : 'asc', page: 1 })
    else navigate({ sort: key, dir: 'asc', page: 1 })
  }

  const visibleContacts = contacts.filter((c) => !removedIds.has(c.id))

  function handleRemove(contact: ContactRowData) {
    setRemovedIds((prev) => new Set(prev).add(contact.id))
    setUndo(contact)
    startTransition(async () => {
      await deleteContact(contact.id)
    })
  }

  function handleUndo() {
    if (!undo) return
    const contactId = undo.id
    setUndo(null)
    startTransition(async () => {
      await restoreContact(contactId)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name, company, or email…"
          className="max-w-sm"
        />
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input type="checkbox" checked={pin} onChange={(e) => navigate({ pin: e.target.checked, page: 1 })} />
          Priority contacts on top
        </label>
        <select
          value={emailFilter}
          onChange={(e) => navigate({ email: e.target.value as 'all' | 'has' | 'missing', page: 1 })}
          className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground"
        >
          <option value="all">All contacts</option>
          <option value="has">Has email</option>
          <option value="missing">No email</option>
        </select>
        {undo && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5 text-sm">
            <span className="text-muted-foreground">Removed {undo.name}.</span>
            <button type="button" onClick={handleUndo} className="font-medium text-primary underline underline-offset-4">
              Undo
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
              {SORTABLE_COLUMNS.map((col) => (
                <th key={col.key} className="px-3 py-2 font-medium">
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    {col.label}
                    {sortKey === col.key && <span aria-hidden>{dir === 'asc' ? '▲' : '▼'}</span>}
                  </button>
                </th>
              ))}
              {DISPLAY_COLUMNS.map((label) => (
                <th key={label} className="px-3 py-2 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleContacts.length === 0 && (
              <tr>
                <td colSpan={SORTABLE_COLUMNS.length + DISPLAY_COLUMNS.length} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {query ? 'No contacts match your search.' : 'No contacts yet.'}
                </td>
              </tr>
            )}
            {visibleContacts.map((contact) => (
              <ContactRowExpandable
                key={contact.id}
                contact={contact}
                isExpanded={expandedId === contact.id}
                onToggleExpand={() => setExpandedId((id) => (id === contact.id ? null : contact.id))}
                onRemove={() => handleRemove(contact)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            Showing {(page - 1) * 50 + 1}–{Math.min(totalCount, page * 50)} of {totalCount}
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => navigate({ page: page - 1 })}>
              Previous
            </Button>
            <span className="tabular-nums">
              Page {page} of {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => navigate({ page: page + 1 })}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {removedCount > 0 && (
        <Link
          href="/dashboard/network/contacts/removed"
          className="text-sm font-medium text-primary underline underline-offset-4"
        >
          Removed contacts ({removedCount})
        </Link>
      )}
    </div>
  )
}

function ContactRowExpandable({
  contact,
  isExpanded,
  onToggleExpand,
  onRemove,
}: {
  contact: ContactRowData
  isExpanded: boolean
  onToggleExpand: () => void
  onRemove: () => void
}) {
  const [, startTransition] = useTransition()
  const [isPriority, setIsPriority] = useState(contact.isPriority)

  function handlePriorityClick() {
    const next = !isPriority
    setIsPriority(next)
    startTransition(async () => {
      await toggleContactPriority(contact.id, next)
    })
  }

  return (
    <>
      <tr className={cn(isExpanded && 'bg-muted/30')}>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={isPriority ? 'Unmark as priority' : 'Mark as priority'}
              onClick={handlePriorityClick}
              className="text-muted-foreground hover:text-orange"
            >
              <Star className={cn('size-4', isPriority && 'fill-orange text-orange')} />
            </button>
            <button
              type="button"
              onClick={onToggleExpand}
              className="text-xs font-medium text-primary hover:underline"
            >
              {isExpanded ? 'Hide' : 'Edit'}
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="text-xs font-medium text-muted-foreground hover:text-destructive"
            >
              Remove
            </button>
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="text-xs font-medium text-primary hover:underline"
              >
                Email
              </a>
            )}
          </div>
        </td>
        <td className="px-3 py-2 font-medium text-foreground">
          <ContactNameLink contact={contact} />
        </td>
        <td className="px-3 py-2 text-muted-foreground">{contact.company ?? '—'}</td>
        <td className="px-3 py-2 text-muted-foreground">
          {contact.connectedAt ? contact.connectedAt.toLocaleDateString() : '—'}
        </td>
        <td className="px-3 py-2 text-muted-foreground">{relationshipSummary(contact.relationshipTags)}</td>
        <td className="px-3 py-2">
          {contact.hasReachedOut ? (
            <span className="text-brand">✓{contact.lastOutreachChannel ? ` ${contact.lastOutreachChannel.toLowerCase()}` : ''}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-3 py-2">
          {contact.membership ? (
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
              {MEMBERSHIP_LABEL[contact.membership]}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={7} className="bg-muted/20 px-4 py-4">
            <ContactDetailPanel contact={contact} />
          </td>
        </tr>
      )}
    </>
  )
}

function ContactNameLink({ contact }: { contact: ContactRowData }) {
  if (!contact.linkedinUrl) return <>{contact.name}</>
  return (
    <a
      href={contact.linkedinUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline"
    >
      {contact.name}
    </a>
  )
}

function ContactDetailPanel({ contact }: { contact: ContactRowData }) {
  const referenceHref = `/dashboard/references?name=${encodeURIComponent(contact.name)}&email=${encodeURIComponent(
    contact.email ?? ''
  )}`
  const [dirty, setDirty] = useState(false)

  return (
    <div className="space-y-4">
      <form
        action={updateContact.bind(null, contact.id)}
        className="space-y-3"
        onChange={() => setDirty(true)}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <LabeledInput name="name" label="Name" defaultValue={contact.name} required className="max-w-[220px]" />
          <LabeledInput name="company" label="Company" defaultValue={contact.company ?? ''} className="max-w-[220px]" />
          <LabeledInput name="title" label="Title" defaultValue={contact.title ?? ''} />
          <LabeledInput name="email" label="Email" type="email" defaultValue={contact.email ?? ''} />
          <LabeledInput name="phone" label="Phone" type="tel" defaultValue={contact.phone ?? ''} />
          <LabeledInput name="linkedinUrl" label="LinkedIn URL" type="url" defaultValue={contact.linkedinUrl ?? ''} />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <RelationshipTagsFieldset
            defaultTags={contact.relationshipTags}
            inferredCompany={contact.inferredCompany}
            inferredSchool={contact.inferredSchool}
          />
          <input type="hidden" name="warmth" value={contact.warmth} />
          <SubmitButton size="sm" variant={dirty ? 'success' : 'outline'}>
            Save
          </SubmitButton>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <a href={referenceHref} className="text-sm font-medium text-primary underline underline-offset-4">
          Request a reference from {contact.name} →
        </a>
      </div>
    </div>
  )
}

function LabeledInput({
  name,
  label,
  defaultValue,
  type = 'text',
  required,
  className,
}: {
  name: string
  label: string
  defaultValue?: string
  type?: string
  required?: boolean
  className?: string
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className={cn('h-8 text-sm', className)}
      />
    </div>
  )
}
