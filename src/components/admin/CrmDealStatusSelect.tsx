'use client'

import { useState, useTransition } from 'react'
import type { CrmDealStatus } from '@prisma/client'
import { setOrgDealStatus } from '@/app/support/admin/(portal)/crm/actions'
import { setCollegeDealStatus } from '@/app/support/admin/(portal)/crm/colleges/actions'
import { DEAL_STATUSES, DEAL_STATUS_LABELS } from '@/lib/crm/deal-status'

/**
 * Where a deal stands, settable in place. Pass orgId for an organization,
 * or collegeId for a college that may not have an organization yet.
 */
export function CrmDealStatusSelect({
  orgId, collegeId, value, surface = 'record',
}: {
  orgId?: string
  collegeId?: string
  value: CrmDealStatus | null
  surface?: 'record' | 'list'
}) {
  const [pending, start] = useTransition()
  const [state, setState] = useState<'idle' | 'saved' | 'error'>('idle')
  const save = (next: string) =>
    start(async () => {
      try {
        if (collegeId) await setCollegeDealStatus(collegeId, next)
        else if (orgId) await setOrgDealStatus(orgId, next, surface)
        setState('saved')
      } catch {
        setState('error')
      }
    })
  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        aria-label="Deal status"
        defaultValue={value ?? ''}
        disabled={pending}
        onChange={(e) => save(e.target.value)}
        className={`h-7 rounded border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand ${pending ? 'cursor-wait opacity-60' : ''}`}
      >
        <option value="">No deal</option>
        {DEAL_STATUSES.map((s) => <option key={s} value={s}>{DEAL_STATUS_LABELS[s]}</option>)}
      </select>
      {state === 'saved' && !pending && <span className="text-[11px] text-muted-foreground" role="status">Saved</span>}
      {state === 'error' && !pending && <span className="text-[11px] text-destructive" role="alert">Not saved — try again</span>}
    </span>
  )
}
