'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { summarizeNotes } from '@/app/support/coach/(app)/clients/[token]/[clientId]/summary-actions'
import type { SummaryView } from '@/lib/coach/note-summary-service'

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-foreground">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

// One button, on request only. The summary is written by an AI model from the coach's own notes,
// so it says so and points back to the notes.
export function NoteSummaryCard({ token, clientId, view, sessionsWithNotes, dailyLimit }: { token: string; clientId: string; view: SummaryView; sessionsWithNotes: number; dailyLimit: number }) {
  const [state, action] = useActionState(summarizeNotes.bind(null, token, clientId), undefined)
  const canSummarize = sessionsWithNotes > 0
  const upToDate = view !== null && !view.stale
  const label = view === null ? 'Summarize my notes' : 'Update the summary'

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm font-medium text-muted-foreground">Your session notes, summarized</p>

      {view && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-foreground">{view.summary.whereThingsStand}</p>
          <List title="Themes across sessions" items={view.summary.themes} />
          <List title="Still open" items={view.summary.openCommitments} />
          <List title="Worth watching" items={view.summary.watchouts} />
          <p className="text-xs text-muted-foreground">
            Written by an AI model from {view.truncated ? `your ${view.sessionCount} most recent sessions with notes` : `${view.sessionCount} ${view.sessionCount === 1 ? 'session' : 'sessions'} of your notes`} on{' '}
            {view.generatedAt.toLocaleDateString('en-US', { dateStyle: 'medium' })}. Check it against your notes before you rely on it.
            {view.stale ? ' You have logged notes since, so it is out of date.' : ''}
          </p>
        </div>
      )}

      {!canSummarize ? (
        <p className="mt-2 text-sm text-muted-foreground">Once you log a session with notes, you can have them summarized here.</p>
      ) : upToDate ? (
        <p className="mt-3 text-sm text-muted-foreground">This summary covers all your notes so far.</p>
      ) : (
        <form action={action} className="mt-3 space-y-2">
          <SubmitButton size="sm" pendingLabel="Summarizing…" savedLabel={label}>
            {label}
          </SubmitButton>
          <p className="text-xs text-muted-foreground">
            This sends your notes for this client to an AI model to write the summary. Only your own notes are used, and you can make up to {dailyLimit} summaries a day.
          </p>
        </form>
      )}

      {state?.message && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {state.message}
        </p>
      )}
      {state?.error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {state.error}
        </p>
      )}
    </div>
  )
}
