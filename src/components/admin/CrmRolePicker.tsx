'use client'

import { useEffect, useRef, useState } from 'react'
import { PERSON_ROLES, PERSON_ROLE_LABELS } from '@/lib/crm/labels'
import type { CrmPersonRole } from '@prisma/client'

/**
 * Collapsed, it shows only what's already selected — click to expand into
 * every option at once as a checkbox grid, not a native <select multiple>
 * (a fixed few rows visible at a time, and a modifier key most people never
 * discover to pick more than one). All 16 contact types fit in the open
 * panel without scrolling.
 *
 * Two usage shapes: pass `name` for a plain form field (CrmQuickAdd,
 * CrmBulkBar) — selections mirror into hidden inputs so a normal
 * `formData.getAll(name)` on submit sees them even though the checkboxes
 * themselves are only in the DOM while open. Pass `onToggle` instead for an
 * auto-saving inline editor (CrmInlineRoles) that persists on every change.
 */
export function CrmRolePicker({
  name, defaultSelected = [], onToggle, label, placeholder = 'No contact type',
}: {
  name?: string
  defaultSelected?: CrmPersonRole[]
  onToggle?: (next: CrmPersonRole[]) => void
  label: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<CrmPersonRole[]>(defaultSelected)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const toggle = (r: CrmPersonRole) => {
    const next = selected.includes(r) ? selected.filter((x) => x !== r) : [...selected, r]
    setSelected(next)
    onToggle?.(next)
  }

  return (
    <div ref={ref} className="relative inline-block">
      {name && selected.map((r) => <input key={r} type="hidden" name={name} value={r} />)}
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="min-w-36 max-w-56 truncate rounded border border-input bg-transparent px-1.5 py-1 text-left text-xs outline-none hover:border-ring focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
      >
        {selected.length > 0 ? selected.map((r) => PERSON_ROLE_LABELS[r]).join(' · ') : placeholder}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 grid w-72 grid-cols-2 gap-0.5 rounded-md border border-border bg-background p-2 shadow-lg">
          {PERSON_ROLES.map((r) => (
            <label key={r} className="flex items-center gap-1.5 rounded px-1.5 py-1 text-xs hover:bg-muted">
              <input type="checkbox" checked={selected.includes(r)} onChange={() => toggle(r)} />
              {PERSON_ROLE_LABELS[r]}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
