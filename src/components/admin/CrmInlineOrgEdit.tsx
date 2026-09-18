'use client'

import { useTransition } from 'react'
import { updatePersonPrimaryOrg } from '@/app/support/admin/(portal)/crm/actions'

// Free-text with a shared <datalist> for autocomplete, not a <select> — there
// are thousands of organizations, and typing a new one should create it
// (same "type it, get it" pattern as the WARN page's manual-add company field).
export function CrmInlineOrgEdit({ personId, orgName }: { personId: string; orgName: string | null }) {
  const [pending, start] = useTransition()

  return (
    <input
      list="crm-org-names"
      defaultValue={orgName ?? ''}
      placeholder="—"
      disabled={pending}
      aria-label="Organization"
      title={orgName ?? undefined}
      onBlur={(e) => {
        const next = e.target.value.trim()
        if (next === (orgName ?? '').trim()) return
        start(() => { void updatePersonPrimaryOrg(personId, next) })
      }}
      className={`h-7 w-full min-w-0 rounded border border-transparent bg-transparent px-1 text-sm outline-none hover:border-input focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand ${pending ? 'cursor-progress opacity-60' : ''}`}
    />
  )
}
