'use client'

// Shared by the Search Strategy forms that need every question answered: the
// "Pick one to save." note under an open question, the list of what is still
// open, and the scroll to the first one. A form passes `showMissing` once a save
// was blocked, so nothing is flagged before the member has tried to save.

export interface MissingQuestion {
  /** DOM id of the question's wrapper, used to scroll to it. */
  id: string
  /** What the member sees in the list of open questions. */
  label: string
}

export function MissingNote({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <p role="alert" className="text-sm text-destructive">
      Pick one to save.
    </p>
  )
}

export function MissingSummary({ show, missing }: { show: boolean; missing: MissingQuestion[] }) {
  if (!show || missing.length === 0) return null
  return (
    <div role="alert" className="space-y-1 text-sm text-destructive">
      <p>Answer these to save. Everything you have already picked is kept:</p>
      <ul className="list-disc pl-5">
        {missing.map((m) => (
          <li key={m.id}>{m.label}</li>
        ))}
      </ul>
    </div>
  )
}

export function scrollToQuestion(id: string) {
  document.getElementById(id)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}
