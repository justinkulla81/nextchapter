'use client'

import { useMemo, useState, useTransition } from 'react'
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
import { cn } from '@/lib/utils'

const RELATIONSHIP_LABEL: Record<RelationshipTag, string> = Object.fromEntries(
  RELATIONSHIP_TAG_OPTIONS.map((o) => [o.value, o.label])
) as Record<RelationshipTag, string>

export interface ContactRowData extends SupportNetworkContact {
  hasReachedOut: boolean
  lastOutreachChannel: string | null
  membership: NextChapterMembership | null
}

type SortKey = 'name' | 'company' | 'relationship' | 'date' | 'reachedOut' | 'priority' | 'membership'

const PAGE_SIZE = 100

function relationshipSummary(tags: RelationshipTag[]): string {
  if (tags.length === 0) return '—'
  return tags.map((t) => RELATIONSHIP_LABEL[t]).join(', ')
}

export function ContactDirectoryTable({
  contacts,
  removedCount,
}: {
  contacts: ContactRowData[]
  removedCount: number
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [priorityPin, setPriorityPin] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())
  const [undo, setUndo] = useState<ContactRowData | null>(null)
  const [rawPage, setPage] = useState(0)

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(0)
  }

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    let list = contacts.filter((c) => !removedIds.has(c.id))
    if (term) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          (c.company ?? '').toLowerCase().includes(term) ||
          (c.email ?? '').toLowerCase().includes(term)
      )
    }
    const dir = sortDir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      if (priorityPin) {
        const priorityDiff = Number(b.isPriority) - Number(a.isPriority)
        if (priorityDiff !== 0) return priorityDiff
      }
      switch (sortKey) {
        case 'name':
          return dir * a.name.localeCompare(b.name)
        case 'company':
          return dir * (a.company ?? '').localeCompare(b.company ?? '')
        case 'relationship':
          return dir * relationshipSummary(a.relationshipTags).localeCompare(relationshipSummary(b.relationshipTags))
        case 'reachedOut':
          return dir * (Number(a.hasReachedOut) - Number(b.hasReachedOut))
        case 'priority':
          return dir * (Number(a.isPriority) - Number(b.isPriority))
        case 'membership':
          return dir * (Number(!!a.membership) - Number(!!b.membership))
        case 'date':
        default:
          // Falls back to createdAt only to keep sort order well-defined for
          // contacts with no real connectedAt (most manually-added ones) —
          // the column itself still shows "—" rather than that fallback.
          return (
            dir *
            ((a.connectedAt ?? a.createdAt).getTime() - (b.connectedAt ?? b.createdAt).getTime())
          )
      }
    })
  }, [contacts, removedIds, search, sortKey, sortDir, priorityPin])

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  // Clamp at render time rather than in an effect — the underlying list can
  // shrink (removals) or narrow (search/sort) between renders, and a stale
  // page index would otherwise point past the end and render nothing.
  const page = Math.min(rawPage, pageCount - 1)

  const pageItems = useMemo(() => visible.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE), [visible, page])

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

  const columns: { key: SortKey; label: string }[] = [
    { key: 'priority', label: 'Priority' },
    { key: 'name', label: 'Name' },
    { key: 'company', label: 'Company' },
    { key: 'relationship', label: 'Relationship' },
    { key: 'date', label: 'Date connected' },
    { key: 'reachedOut', label: 'Reached out' },
    { key: 'membership', label: 'On NextChapter' },
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
          placeholder="Search by name, company, or email…"
          className="max-w-sm"
        />
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={priorityPin}
            onChange={(e) => setPriorityPin(e.target.checked)}
          />
          Priority contacts on top
        </label>
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
              {columns.map((col) => (
                <th key={col.key} className="px-3 py-2 font-medium">
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    {col.label}
                    {sortKey === col.key && <span aria-hidden>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {search ? 'No contacts match your search.' : 'No contacts yet.'}
                </td>
              </tr>
            )}
            {pageItems.map((contact) => (
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
            Showing {page * PAGE_SIZE + 1}–{Math.min(visible.length, (page + 1) * PAGE_SIZE)} of {visible.length}
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="tabular-nums">
              Page {page + 1} of {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => p + 1)}
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
          </div>
        </td>
        <td className="px-3 py-2 font-medium text-foreground">
          <ContactNameLink contact={contact} />
        </td>
        <td className="px-3 py-2 text-muted-foreground">{contact.company ?? '—'}</td>
        <td className="px-3 py-2 text-muted-foreground">{relationshipSummary(contact.relationshipTags)}</td>
        <td className="px-3 py-2 text-muted-foreground">
          {contact.connectedAt ? contact.connectedAt.toLocaleDateString() : '—'}
        </td>
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
    <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
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
