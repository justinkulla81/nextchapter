'use client'

import { useState } from 'react'

// Shared "✓ Answered" collapse for one-time/optional confirm forms
// (Screening Questions, demographic self-ID, work authorization) — same
// summary treatment everywhere instead of some sections collapsing and
// others always showing the open form. Local `editing` state means
// clicking Edit reveals the form even after it's answered; it stays open
// through a save (the form's own Save/Saved button already confirms the
// write landed) rather than snapping shut and hiding that confirmation.
export function AnsweredConfirmSection({
  answered,
  children,
}: {
  answered: boolean
  children: React.ReactNode
}) {
  const [editing, setEditing] = useState(false)

  if (answered && !editing) {
    return (
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="text-success" aria-hidden>
            ✓
          </span>
          Answered
        </p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-medium text-brand hover:underline"
        >
          Edit
        </button>
      </div>
    )
  }

  return <>{children}</>
}
