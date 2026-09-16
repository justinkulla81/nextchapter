'use client'

import { useState, useTransition } from 'react'
import { deletePerson } from '@/app/support/admin/(portal)/crm/actions'
import { CrmMergePicker } from './CrmMergePicker'

/**
 * Owns removing itself the instant an action resolves, rather than waiting
 * on the whole (possibly 1000+ row) list to revalidate — reviewing a big
 * backlog needs each decision to feel instant, not trigger a full reload.
 *
 * A row flagged as not-a-real-person gets exactly one action, "Remove" —
 * per design-principles.md's "one primary action" rule, offering
 * Merge/Fill-in-by-hand/Use-this alongside a confident junk verdict is
 * noise, not choice.
 */
export function CrmNeedsCompletionRow({
  personId, personName, notAPerson, mergeTarget, secondaryAction, children,
}: {
  personId: string
  personName: string
  notAPerson: boolean
  mergeTarget: { id: string; fullName: string } | null
  /** "Use this" / "Fill in by hand" — whichever applies, already built by the caller. */
  secondaryAction: React.ReactNode
  children: React.ReactNode
}) {
  const [removed, setRemoved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  if (removed) return null

  const remove = () => {
    if (!window.confirm(`Delete ${personName}? This can't be undone.`)) return
    setError(null)
    setRemoved(true) // optimistic — the common case succeeds; roll back below if it didn't.
    start(async () => {
      const res = await deletePerson(personId)
      if (!res.deleted) { setRemoved(false); setError(res.message) }
    })
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
      {children}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {error && <span className="text-xs text-destructive">{error}</span>}
        {notAPerson ? (
          <button
            type="button"
            disabled={pending}
            onClick={remove}
            className={`rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white ${pending ? 'cursor-progress opacity-60' : ''}`}
          >
            Remove
          </button>
        ) : (
          <>
            {secondaryAction}
            <CrmMergePicker personId={personId} personName={personName} suggested={mergeTarget} onMerged={() => setRemoved(true)} />
            <button
              type="button"
              disabled={pending}
              onClick={remove}
              className={`rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted ${pending ? 'cursor-progress opacity-60' : ''}`}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  )
}
