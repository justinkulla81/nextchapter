'use client'

import { useTransition } from 'react'
import { setItemField } from '@/app/support/admin/(portal)/vision/actions'

type Field = 'kind' | 'area' | 'status' | 'bucket' | 'effort' | 'priority' | 'title'

// Prioritising and scheduling are things you do to twenty rows in one sitting,
// looking at them next to each other. Opening twenty item pages to do it is
// how a roadmap stops getting groomed — so the roadmap row itself is
// editable, same save-on-change pattern as CrmInlineSelect.
export function VisionInlineSelect({
  itemId, field, value, options, label, className,
}: {
  itemId: string
  field: Field
  value: string
  options: { value: string; label: string }[]
  label: string
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
        start(() => { void setItemField(itemId, field, next) })
      }}
      className={`h-7 rounded border border-input px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand ${pending ? 'cursor-progress opacity-60' : ''} ${className ?? 'bg-transparent'}`}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

/** Grouped variant — the kind picker, which has twelve options in three groups. */
export function VisionInlineKindSelect({
  itemId, value, groups, labels,
}: {
  itemId: string
  value: string
  groups: { label: string; kinds: string[] }[]
  labels: Record<string, string>
}) {
  const [pending, start] = useTransition()

  return (
    <select
      aria-label="Kind"
      defaultValue={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value
        start(() => { void setItemField(itemId, 'kind', next) })
      }}
      className={`h-7 rounded border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand ${pending ? 'cursor-progress opacity-60' : ''}`}
    >
      {groups.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.kinds.map((k) => <option key={k} value={k}>{labels[k]}</option>)}
        </optgroup>
      ))}
    </select>
  )
}

/** Rename in place — saves on blur or Enter, same pattern as CrmInlineText. */
export function VisionInlineTitle({ itemId, value }: { itemId: string; value: string }) {
  const [pending, start] = useTransition()

  return (
    <input
      type="text"
      aria-label="Title"
      defaultValue={value}
      disabled={pending}
      onBlur={(e) => {
        const next = e.target.value
        if (next.trim() === value.trim() || !next.trim()) return
        start(() => { void setItemField(itemId, 'title', next) })
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      className={`w-full min-w-0 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium outline-none hover:border-input focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand ${pending ? 'cursor-progress opacity-60' : ''}`}
    />
  )
}
