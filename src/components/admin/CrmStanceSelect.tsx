'use client'

import { useTransition } from 'react'
import { setResearchStance } from '@/app/support/admin/(portal)/crm/actions'
import type { CrmResearchStance } from '@prisma/client'

export const STANCE_LABEL: Record<string, string> = {
  SUPPORTS: 'Supports our thesis',
  CONTRADICTS: 'Cuts against it',
  MIXED: 'Mixed',
  NEUTRAL: 'Neutral',
  UNSET: 'Not judged yet',
}

export const STANCE_CLASS: Record<string, string> = {
  SUPPORTS: 'bg-brand/15 text-brand',
  CONTRADICTS: 'bg-destructive/10 text-destructive',
  MIXED: 'bg-orange/15 text-orange',
  NEUTRAL: 'bg-muted text-muted-foreground',
  UNSET: 'bg-muted text-muted-foreground',
}

const ORDER: CrmResearchStance[] = ['UNSET', 'SUPPORTS', 'CONTRADICTS', 'MIXED', 'NEUTRAL']

// Stance is a judgement about your own thesis, so it stays a human field —
// auto-classifying it would be both a metered cost and a way to walk into a
// meeting confidently wrong.
export function CrmStanceSelect({ itemId, stance, title }: { itemId: string; stance: string; title: string }) {
  const [pending, start] = useTransition()
  return (
    <select
      aria-label={`Stance for ${title}`}
      defaultValue={stance}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as CrmResearchStance
        start(() => { void setResearchStance(itemId, next) })
      }}
      className={`h-7 rounded border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand ${pending ? 'cursor-progress opacity-60' : ''}`}
    >
      {ORDER.map((s) => <option key={s} value={s}>{STANCE_LABEL[s]}</option>)}
    </select>
  )
}
