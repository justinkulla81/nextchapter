'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
 *
 * "Remove" everywhere, never "Delete" — this is always a soft delete (the
 * record and its history survive, just hidden), matching the wording
 * already used by the People page's own bulk remove. Calling the same
 * operation "Delete" here and "Remove" there was the actual bug a past
 * review caught: same soft-delete underneath, two words implying different
 * severity.
 */
export function CrmNeedsCompletionRow({
  personId, personName, notAPerson, mergeTarget, acceptSuggestion, secondaryAction, children,
}: {
  personId: string
  personName: string
  notAPerson: boolean
  mergeTarget: { id: string; fullName: string } | null
  /** Bound acceptExportSuggestion(personId) — set only when the row has an export prefill to accept. */
  acceptSuggestion?: () => Promise<{ accepted: boolean }>
  /** "Fill in by hand" — rendered only when there's no suggestion to accept instead. */
  secondaryAction?: React.ReactNode
  children: React.ReactNode
}) {
  const router = useRouter()
  const [removed, setRemoved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  if (removed) return null

  const remove = () => {
    if (!window.confirm(`Remove ${personName} from the CRM? They'll stop showing up anywhere.`)) return
    setError(null)
    setRemoved(true) // optimistic — the common case succeeds; roll back below if it didn't.
    start(async () => {
      const res = await deletePerson(personId)
      if (!res.deleted) { setRemoved(false); setError(res.message) }
      // A merge target elsewhere in the list may have just lost its only
      // duplicate — router.refresh() re-fetches everyone's server-computed
      // recommendation instead of leaving stale ones showing until the next
      // real navigation.
      router.refresh()
    })
  }

  const accept = () => {
    setError(null)
    setRemoved(true) // optimistic — rolled back below if the suggestion had nothing usable to save.
    start(async () => {
      const res = await acceptSuggestion!()
      if (!res.accepted) { setRemoved(false); setError('No usable info in this suggestion — fill in by hand.') }
      router.refresh()
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
            {acceptSuggestion ? (
              <button
                type="button"
                disabled={pending}
                onClick={accept}
                className={`rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted ${pending ? 'cursor-progress opacity-60' : ''}`}
              >
                {pending ? 'Applying…' : 'Use this'}
              </button>
            ) : secondaryAction}
            <CrmMergePicker personId={personId} personName={personName} suggested={mergeTarget} onMerged={() => setRemoved(true)} />
            <button
              type="button"
              disabled={pending}
              onClick={remove}
              className={`rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted ${pending ? 'cursor-progress opacity-60' : ''}`}
            >
              Remove
            </button>
          </>
        )}
      </div>
    </li>
  )
}
