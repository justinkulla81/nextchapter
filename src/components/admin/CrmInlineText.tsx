'use client'

import { useTransition } from 'react'
import { updatePersonField } from '@/app/support/admin/(portal)/crm/actions'

/** Inline text edit for a person field — saves on blur or Enter, same pattern as CrmInlineSelect. */
export function CrmInlineText({
  personId, field, value, label, placeholder, size = 'sm', onSaved,
}: {
  personId: string
  field: 'fullName' | 'notes' | 'title' | 'location'
  value: string
  label: string
  placeholder?: string
  /** 'md' matches the panel's text-sm fields; 'sm' is the compact table-row size. */
  size?: 'sm' | 'md'
  onSaved?: () => void
}) {
  const [pending, start] = useTransition()

  const save = (next: string) => {
    if (next.trim() === value.trim()) return
    start(async () => { await updatePersonField(personId, field, next); onSaved?.() })
  }

  return (
    <input
      type="text"
      aria-label={label}
      key={value}
      defaultValue={value}
      placeholder={placeholder}
      disabled={pending}
      onBlur={(e) => save(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      className={`${size === 'md' ? 'h-8 px-2 text-sm' : 'h-7 px-1.5 text-xs'} w-full min-w-0 rounded border border-input bg-transparent outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand ${pending ? 'cursor-progress opacity-60' : ''}`}
    />
  )
}
