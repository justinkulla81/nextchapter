'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { SubmitButton } from '@/components/ui/submit-button'
import { PERSON_ROLES, PERSON_ROLE_LABELS } from '@/lib/crm/labels'
import {
  quickAddPerson, mergeIntoExisting, createAnyway,
  type QuickAddResult,
} from '@/app/support/admin/(portal)/crm/actions'

const EMPTY: QuickAddResult = { status: 'error', message: '' }

// Quick add is the primary action on the CRM list page, so it sits above the
// fold and owns the only accent-coloured button on the screen.
export function CrmQuickAdd() {
  const [result, action] = useActionState(quickAddPerson, EMPTY)
  const [merged, mergeAction] = useActionState(mergeIntoExisting, EMPTY)
  const [created, createAction] = useActionState(createAnyway, EMPTY)

  // The most recent non-empty outcome wins.
  const latest = [created, merged, result].find((r) => r.message) ?? EMPTY
  const showAmbiguity = result.status === 'ambiguous' && !merged.message && !created.message

  return (
    <div className="rounded-lg border border-border p-4">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <label htmlFor="crm-quick-add" className="mb-1 block text-sm font-medium">
            Add a person
          </label>
          <input
            id="crm-quick-add"
            name="input"
            type="text"
            required
            placeholder="Paste a LinkedIn URL, or type a name"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            A LinkedIn URL prefills name, title and company from your own data export.
          </p>
        </div>
        <div>
          <label htmlFor="crm-quick-role" className="mb-1 block text-sm font-medium">
            Contact type <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <select
            id="crm-quick-role"
            name="role"
            defaultValue=""
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
          >
            <option value="">Decide later</option>
            {PERSON_ROLES.map((r) => (
              <option key={r} value={r}>{PERSON_ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>
        <SubmitButton pendingLabel="Adding…">Add person</SubmitButton>
      </form>

      {showAmbiguity && result.candidates && (
        <DuplicatePrompt
          result={result}
          mergeAction={mergeAction}
          createAction={createAction}
        />
      )}

      {latest.message && !showAmbiguity && (
        <p
          role="status"
          className={`mt-3 text-sm ${latest.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          {latest.message}{' '}
          {latest.personId && (
            <Link href={`/support/admin/crm/people/${latest.personId}`} className="font-medium text-brand underline">
              Open record
            </Link>
          )}
        </p>
      )}
    </div>
  )
}

// Shown only when the name matches but no unique identifier does. Neither
// answer is safe to assume: merging invents a person who doesn't exist,
// creating quietly splits one who does — so this asks instead.
function DuplicatePrompt({
  result, mergeAction, createAction,
}: {
  result: QuickAddResult
  mergeAction: (fd: FormData) => void
  createAction: (fd: FormData) => void
}) {
  const [target, setTarget] = useState(result.candidates?.[0]?.id ?? '')

  return (
    <div className="mt-4 rounded-lg border border-orange/40 bg-orange/5 p-4">
      <p className="text-sm font-medium">{result.message}</p>

      <fieldset className="mt-3 space-y-2">
        <legend className="sr-only">Existing records with this name</legend>
        {result.candidates?.map((c) => (
          <label
            key={c.id}
            className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background p-3 text-sm has-[:checked]:border-brand"
          >
            <input
              type="radio"
              name="existingChoice"
              value={c.id}
              checked={target === c.id}
              onChange={() => setTarget(c.id)}
              className="mt-1"
            />
            <span>
              <span className="font-medium">{c.fullName}</span>
              {c.title && <span className="text-muted-foreground"> — {c.title}</span>}
              {c.org && <span className="text-muted-foreground"> at {c.org}</span>}
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {c.roles.length > 0
                  ? c.roles.map((r) => PERSON_ROLE_LABELS[r as keyof typeof PERSON_ROLE_LABELS] ?? r).join(' · ')
                  : 'No contact type set'}
                {' · '}
                {c.lastTouchedAt ? `last contacted ${new Date(c.lastTouchedAt).toLocaleDateString()}` : 'never contacted'}
              </span>
              {c.linkedinUrl && (
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">{c.linkedinUrl}</span>
              )}
            </span>
          </label>
        ))}
      </fieldset>

      {/* Two discrete choices -> adjacent buttons, per design-principles.md. */}
      <div className="mt-3 flex flex-wrap gap-2">
        <form action={mergeAction}>
          <input type="hidden" name="targetId" value={target} />
          <input type="hidden" name="input" value={result.input ?? ''} />
          <input type="hidden" name="role" value={result.role ?? ''} />
          <SubmitButton pendingLabel="Merging…">Merge into selected</SubmitButton>
        </form>
        <form action={createAction}>
          <input type="hidden" name="input" value={result.input ?? ''} />
          <input type="hidden" name="role" value={result.role ?? ''} />
          <SubmitButton variant="outline" pendingLabel="Adding…">
            Add as a separate person
          </SubmitButton>
        </form>
      </div>
    </div>
  )
}
