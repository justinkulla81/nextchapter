'use client'

import { useTransition } from 'react'
import { updatePersonField } from '@/app/support/admin/(portal)/crm/actions'

/** Inline text edit for a person field — saves on blur or Enter, same pattern as CrmInlineSelect. */
export function CrmInlineText({
  personId, field, value, label, placeholder,
}: {
  personId: string
  field: 'fullName' | 'notes' | 'title' | 'location'
  value: string
  label: string
  placeholder?: string
}) {
  const [pending, start] = useTransition()

  const save = (next: string) => {
    if (next.trim() === value.trim()) return
    start(() => { void updatePersonField(personId, field, next) })
  }

  return (
    <input
      type="text"
      aria-label={label}
      defaultValue={value}
      placeholder={placeholder}
      disabled={pending}
      onBlur={(e) => save(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      className={`h-7 w-full min-w-0 rounded border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand ${pending ? 'cursor-progress opacity-60' : ''}`}
    />
  )
}
