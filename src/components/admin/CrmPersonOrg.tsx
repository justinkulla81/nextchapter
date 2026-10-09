'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { updatePersonPrimaryOrg } from '@/app/support/admin/(portal)/crm/actions'

/**
 * The person's organization: a link to it, how many other people in the CRM
 * work there, and a way to set or change it. Typing a name that isn't in the
 * CRM yet creates the organization.
 */
export function CrmPersonOrg({
  personId, org, title, othersCount,
}: {
  personId: string
  org: { id: string; name: string } | null
  title: string | null
  othersCount: number
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [pending, start] = useTransition()

  const save = () =>
    start(async () => {
      await updatePersonPrimaryOrg(personId, name)
      setEditing(false)
    })

  return (
    <div className="space-y-2 text-sm">
      {org ? (
        <p>
          <span className="text-muted-foreground">{title || 'No title on file'} at </span>
          <Link href={`/support/admin/crm/organizations/${org.id}`} className="font-medium underline">{org.name}</Link>
          <span className="text-muted-foreground"> · </span>
          <Link href={`/support/admin/crm/organizations/${org.id}`} className="underline">
            {othersCount === 0 ? 'No other people there yet' : `${othersCount} other ${othersCount === 1 ? 'person' : 'people'} there`}
          </Link>
        </p>
      ) : (
        <p className="text-muted-foreground">No organization on file.</p>
      )}

      {editing ? (
        <form
          onSubmit={(e) => { e.preventDefault(); save() }}
          className={`flex flex-wrap items-center gap-2 ${pending ? 'cursor-progress' : ''}`}
        >
          <label className="sr-only" htmlFor="person-org">Organization name</label>
          <input
            id="person-org" autoFocus value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Organization name — new names are created"
            className="h-8 min-w-64 flex-1 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
          />
          <button type="submit" disabled={pending || !name.trim()} className="h-8 rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50">
            {pending ? 'Saving…' : 'Save organization'}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="h-8 rounded-md border border-border px-3 text-sm hover:bg-muted">Cancel</button>
        </form>
      ) : (
        <button type="button" onClick={() => { setName(org?.name ?? ''); setEditing(true) }} className="text-xs underline text-muted-foreground hover:text-foreground">
          {org ? 'Change organization' : 'Add organization'}
        </button>
      )}
    </div>
  )
}
