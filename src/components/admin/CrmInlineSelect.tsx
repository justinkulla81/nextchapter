'use client'

import { useTransition } from 'react'
import { updatePersonField } from '@/app/support/admin/(portal)/crm/actions'

// Inline edit straight from a list row — opening 187 records to set 187
// contact types is the kind of task that quietly doesn't get done. Saves on
// change, shows the busy cursor while it does, per design-principles.md.
export function CrmInlineSelect({
  personId, field, value, options, label, className,
}: {
  personId: string
  field: 'leadQuality' | 'warmth' | 'priority'
  value: string
  options: { value: string; label: string }[]
  label: string
  /** Extra classes appended after the default styling — e.g. the priority
   * tier's own color, so the dropdown IS the colored badge instead of a
   * separate plain-text pill sitting next to a second, redundant control. */
  className?: string
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
      className={`h-7 rounded border border-input px-1.5 text-xs font-semibold outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand ${pending ? 'cursor-progress opacity-60' : ''} ${className ?? 'bg-transparent font-normal'}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
