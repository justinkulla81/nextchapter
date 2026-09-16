'use client'

import { useTransition } from 'react'
import { setNetworkLeadPriority } from '@/app/support/admin/(portal)/network-leads/actions'
import { PRIORITY_TIERS, PRIORITY_TIER_LABELS, priorityTierClass } from '@/lib/crm/labels'
import type { CrmPriorityTier } from '@prisma/client'

export function NetworkLeadPrioritySelect({ contactId, value }: { contactId: string; value: CrmPriorityTier | null }) {
  const [pending, start] = useTransition()
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${priorityTierClass(value)}`}>
        {value ?? '—'}
      </span>
      <select
        aria-label="Priority"
        disabled={pending}
        defaultValue={value ?? ''}
        onChange={(e) => start(() => { void setNetworkLeadPriority(contactId, (e.target.value || null) as CrmPriorityTier | null) })}
        className={`h-7 rounded border border-input bg-transparent px-1 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand ${pending ? 'cursor-progress opacity-60' : ''}`}
      >
        <option value="">No priority</option>
        {PRIORITY_TIERS.map((t) => <option key={t} value={t}>{PRIORITY_TIER_LABELS[t]}</option>)}
      </select>
    </span>
  )
}
