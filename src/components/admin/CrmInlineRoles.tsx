'use client'

import { useTransition } from 'react'
import { updatePersonRoles } from '@/app/support/admin/(portal)/crm/actions'
import { PERSON_ROLES, PERSON_ROLE_LABELS } from '@/lib/crm/labels'
import type { CrmPersonRole } from '@prisma/client'

// A person is routinely more than one thing (an advisor who is also a
// hiring manager) — native multi-select straight from the list row, same
// idea as CrmBulkBar's own "pick several" control.
export function CrmInlineRoles({ personId, roles, name }: { personId: string; roles: CrmPersonRole[]; name: string }) {
  const [pending, start] = useTransition()

  return (
    <select
      multiple
      size={3}
      disabled={pending}
      defaultValue={roles}
      aria-label={`Contact types for ${name}`}
      onChange={(e) => {
        const fd = new FormData()
        Array.from(e.target.selectedOptions).forEach((o) => fd.append('roles', o.value))
        start(() => { void updatePersonRoles(personId, fd) })
      }}
      className={`min-w-36 rounded border border-input bg-transparent px-1 py-0.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand ${pending ? 'cursor-progress opacity-60' : ''}`}
    >
      {PERSON_ROLES.map((r) => (
        <option key={r} value={r}>{PERSON_ROLE_LABELS[r]}</option>
      ))}
    </select>
  )
}
