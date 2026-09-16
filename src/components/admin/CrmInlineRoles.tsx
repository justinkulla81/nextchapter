'use client'

import { useTransition } from 'react'
import { updatePersonRoles } from '@/app/support/admin/(portal)/crm/actions'
import { CrmRolePicker } from './CrmRolePicker'
import type { CrmPersonRole } from '@prisma/client'

// A person is routinely more than one thing (an advisor who is also a
// hiring manager) — saves on every toggle, same as the rest of this row's
// inline fields.
export function CrmInlineRoles({
  personId, roles, name, onSaved,
}: {
  personId: string
  roles: CrmPersonRole[]
  name: string
  /** Called after saving — the list page relies on route revalidation instead, so this is optional. */
  onSaved?: () => void
}) {
  const [, start] = useTransition()

  return (
    <CrmRolePicker
      label={`Contact types for ${name}`}
      defaultSelected={roles}
      onToggle={(next) => {
        const fd = new FormData()
        next.forEach((r) => fd.append('roles', r))
        start(async () => { await updatePersonRoles(personId, fd); onSaved?.() })
      }}
    />
  )
}
