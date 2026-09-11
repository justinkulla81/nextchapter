'use client'

import { useTransition } from 'react'
import { moveOpportunityStage } from '@/app/support/admin/(portal)/crm/actions'

// Stage changes use a native select, not drag-and-drop. Every interactive
// element has to be keyboard-accessible per design-principles.md, and a
// select is that by construction — a drag target needs a parallel keyboard
// path built and kept working. Drag can be layered on later.
export function CrmStageSelect({
  opportunityId, stageId, stages, label,
}: {
  opportunityId: string
  stageId: string
  stages: { id: string; label: string }[]
  label: string
}) {
  const [pending, start] = useTransition()
  return (
    <select
      aria-label={label}
      defaultValue={stageId}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value
        start(() => { void moveOpportunityStage(opportunityId, next) })
      }}
      className={`h-7 w-full rounded border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand ${pending ? 'cursor-progress opacity-60' : ''}`}
    >
      {stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
    </select>
  )
}
