'use client'

import { useTransition } from 'react'
import { updatePersonField } from '@/app/support/admin/(portal)/crm/actions'

// Inline edit straight from a list row — opening 187 records to set 187
// contact types is the kind of task that quietly doesn't get done. Saves on
// change, shows the busy cursor while it does, per design-principles.md.
export function CrmInlineSelect({
  personId, field, value, options, label,
}: {
  personId: string
  field: 'leadQuality' | 'warmth'
  value: string
  options: { value: string; label: string }[]
  label: string
}) {
  const [pending, start] = useTransition()

  return (
    <select
      aria-label={label}
      defaultValue={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value
        start(() => { void updatePersonField(personId, field, next) })
      }}
      className={`h-7 rounded border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand ${pending ? 'cursor-progress opacity-60' : ''}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
