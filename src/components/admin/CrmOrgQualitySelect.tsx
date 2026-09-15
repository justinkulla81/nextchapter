'use client'

import { useTransition } from 'react'
import { updateOrgQuality } from '@/app/support/admin/(portal)/crm/actions'
import { QUALITIES, QUALITY_LABELS } from '@/lib/crm/labels'
import type { CrmLeadQuality } from '@prisma/client'

export function CrmOrgQualitySelect({ orgId, value }: { orgId: string; value: CrmLeadQuality }) {
  const [pending, start] = useTransition()
  return (
    <select
      aria-label="Quality"
      defaultValue={value}
      disabled={pending}
      onChange={(e) => start(() => { void updateOrgQuality(orgId, e.target.value) })}
      className={`h-7 rounded border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand ${pending ? 'cursor-progress opacity-60' : ''}`}
    >
      {QUALITIES.map((q) => <option key={q} value={q}>{QUALITY_LABELS[q]}</option>)}
    </select>
  )
}
