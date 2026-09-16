'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { updatePersonGoals } from '@/app/support/admin/(portal)/crm/actions'
import { GOALS, GOAL_LABELS } from '@/lib/crm/goals'
import type { CrmGoal } from '@prisma/client'

/**
 * Goal starts out derived from roles but is editable — see
 * updatePersonGoals' own comment. Only 7 possible values, so a small
 * dedicated checkbox dropdown here rather than reworking CrmRolePicker
 * (hardcoded to PERSON_ROLES, with three other call sites already relying
 * on that) into a generic multi-select it was never designed to be.
 */
export function CrmInlineGoals({
  personId, goals, name, onSaved,
}: {
  personId: string
  goals: CrmGoal[]
  name: string
  onSaved?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<CrmGoal[]>(goals)
  const [, start] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const toggle = (g: CrmGoal) => {
    const next = selected.includes(g) ? selected.filter((x) => x !== g) : [...selected, g]
    setSelected(next)
    const fd = new FormData()
    next.forEach((v) => fd.append('goals', v))
    start(async () => { await updatePersonGoals(personId, fd); onSaved?.() })
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-label={`Goals for ${name}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="min-w-24 max-w-56 truncate rounded border border-input bg-transparent px-1.5 py-1 text-left text-xs outline-none hover:border-ring focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
      >
        {selected.length > 0 ? selected.map((g) => GOAL_LABELS[g]).join(' · ') : '—'}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 grid w-56 gap-0.5 rounded-md border border-border bg-background p-2 shadow-lg">
          {GOALS.map((g) => (
            <label key={g} className="flex items-center gap-1.5 rounded px-1.5 py-1 text-xs hover:bg-muted">
              <input type="checkbox" checked={selected.includes(g)} onChange={() => toggle(g)} />
              {GOAL_LABELS[g]}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
