'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { SupportNetworkContact, ContactWarmth, RelationshipTag } from '@prisma/client'
import { Star } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RelationshipTagsFieldset, RELATIONSHIP_TAG_OPTIONS } from '@/components/dashboard/RelationshipTagsFieldset'
import {
  updateContact,
  deleteContact,
  restoreContact,
  toggleContactPriority,
  logOutreach,
} from '@/app/dashboard/network/actions'
import { cn } from '@/lib/utils'

const RELATIONSHIP_LABEL: Record<RelationshipTag, string> = Object.fromEntries(
  RELATIONSHIP_TAG_OPTIONS.map((o) => [o.value, o.label])
) as Record<RelationshipTag, string>

export interface ContactRowData extends SupportNetworkContact {
  hasReachedOut: boolean
  lastOutreachChannel: string | null
}

type SortKey = 'name' | 'company' | 'relationship' | 'date' | 'reachedOut' | 'priority'

const WARMTH_LABEL: Record<ContactWarmth, string> = { HOT: 'Hot', WARM: 'Warm', COLD: 'Cold' }

function relationshipSummary(tags: RelationshipTag[]): string {
  if (tags.length === 0) return '—'
  return tags.map((t) => RELATIONSHIP_LABEL[t]).join(', ')
}

export function ContactDirectoryTable({ contacts }: { contacts: ContactRowData[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())
  const [undo, setUndo] = useState<ContactRowData | null>(null)

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
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
        case 'date':
        default:
          return dir * (a.createdAt.getTime() - b.createdAt.getTime())
      }
    })
  }, [contacts, removedIds, search, sortKey, sortDir])

  function handleRemove(contact: ContactRowData) {
    setRemovedIds((prev) => new Set(prev).add(contact.id))
    setUndo(contact)
    startTransition(async () => {
      await deleteContact(contact.id)
    })
  }

  function handleUndo() {
    if (!undo) return
    const snapshot = undo
    setUndo(null)
    startTransition(async () => {
      await restoreContact({
        name: snapshot.name,
        company: snapshot.company,
        title: snapshot.title,
        email: snapshot.email,
        phone: snapshot.phone,
        linkedinUrl: snapshot.linkedinUrl,
        warmth: snapshot.warmth,
        relationshipTags: snapshot.relationshipTags,
        isPriority: snapshot.isPriority,
      })
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
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, company, or email…"
          className="max-w-sm"
        />
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
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {search ? 'No contacts match your search.' : 'No contacts yet.'}
                </td>
              </tr>
            )}
            {visible.map((contact) => (
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
      <tr className={cn('cursor-pointer hover:bg-muted/30', isExpanded && 'bg-muted/30')} onClick={onToggleExpand}>
        <td className="px-3 py-2">
          <button
            type="button"
            aria-label={isPriority ? 'Unmark as priority' : 'Mark as priority'}
            onClick={(e) => {
              e.stopPropagation()
              handlePriorityClick()
            }}
            className="text-muted-foreground hover:text-orange"
          >
            <Star className={cn('size-4', isPriority && 'fill-orange text-orange')} />
          </button>
        </td>
        <td className="px-3 py-2 font-medium text-foreground">{contact.name}</td>
        <td className="px-3 py-2 text-muted-foreground">{contact.company ?? '—'}</td>
        <td className="px-3 py-2 text-muted-foreground">{relationshipSummary(contact.relationshipTags)}</td>
        <td className="px-3 py-2 text-muted-foreground">{contact.createdAt.toLocaleDateString()}</td>
        <td className="px-3 py-2">
          {contact.hasReachedOut ? (
            <span className="text-brand">✓{contact.lastOutreachChannel ? ` ${contact.lastOutreachChannel.toLowerCase()}` : ''}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-3 py-2 text-right text-xs text-muted-foreground">{isExpanded ? 'Hide ▲' : 'Details ▼'}</td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={7} className="bg-muted/20 px-4 py-4">
            <ContactDetailPanel contact={contact} onRemove={onRemove} />
          </td>
        </tr>
      )}
    </>
  )
}

function ContactDetailPanel({ contact, onRemove }: { contact: ContactRowData; onRemove: () => void }) {
  const referenceHref = `/dashboard/references?name=${encodeURIComponent(contact.name)}&email=${encodeURIComponent(
    contact.email ?? ''
  )}`

  return (
    <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
      <form action={updateContact.bind(null, contact.id)} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <LabeledInput name="name" label="Name" defaultValue={contact.name} required />
          <LabeledInput name="company" label="Company" defaultValue={contact.company ?? ''} />
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
          <div className="space-y-1">
            <label htmlFor={`warmth-${contact.id}`} className="text-xs font-medium text-muted-foreground">
              Warmth
            </label>
            <Select name="warmth" defaultValue={contact.warmth}>
              <SelectTrigger id={`warmth-${contact.id}`} className="h-8 w-28 text-xs">
                <SelectValue>{(v: string | null) => (v ? WARMTH_LABEL[v as ContactWarmth] : 'Warmth')}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HOT">Hot</SelectItem>
                <SelectItem value="WARM">Warm</SelectItem>
                <SelectItem value="COLD">Cold</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SubmitButton size="sm" variant="outline">
            Save
          </SubmitButton>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <p className="w-full text-xs font-medium text-muted-foreground">How did you reach out?</p>
        <form action={logOutreach.bind(null, contact.id, 'LINKEDIN')}>
          <SubmitButton size="sm" variant="ghost">
            Log LinkedIn outreach
          </SubmitButton>
        </form>
        <form action={logOutreach.bind(null, contact.id, 'EMAIL')}>
          <SubmitButton size="sm" variant="ghost">
            Log email
          </SubmitButton>
        </form>
        <form action={logOutreach.bind(null, contact.id, 'PHONE')}>
          <SubmitButton size="sm" variant="ghost">
            Log call
          </SubmitButton>
        </form>
        <form action={logOutreach.bind(null, contact.id, 'TEXT')}>
          <SubmitButton size="sm" variant="ghost">
            Log text
          </SubmitButton>
        </form>
        <p className="w-full text-xs text-muted-foreground">
          Emails you send from your connected Gmail to this address are logged here automatically.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <a href={referenceHref} className="text-sm font-medium text-primary underline underline-offset-4">
          Request a reference from {contact.name} →
        </a>
        <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
          Remove
        </Button>
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
}: {
  name: string
  label: string
  defaultValue?: string
  type?: string
  required?: boolean
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} required={required} className="h-8 text-sm" />
    </div>
  )
}
