import { parallelPathView } from '@/lib/job-reviews/constants'

// For the pre-session brief: what the client does alongside the search (contract work,
// a business, training…), from the Past jobs page. Private to the client and their
// coach — it is never shown to employers or in the Dossier.
export function CoachParallelPathsCard({ paths, thinking = [] }: { paths: string[] | null; thinking?: { label: string; level: string }[] }) {
  const view = parallelPathView(paths)
  return (
    <div className="space-y-1 rounded-lg border border-border p-4">
      <p className="text-sm font-medium text-muted-foreground">Alongside the search</p>
      {thinking.length > 0 && (
        <p className="text-sm text-foreground">
          Thinking about: {thinking.map((t) => `${t.label.toLowerCase()} (${t.level.toLowerCase()})`).join(', ')}
        </p>
      )}
      {view.state === 'some' && (
        <>
          <p className="text-sm text-foreground">{view.labels.join(', ')}</p>
          <p className="text-xs text-muted-foreground">
            Good openers: ask how much of the week it takes from the search, and whether it&apos;s a bridge or the direction they want.
          </p>
        </>
      )}
      {view.state === 'none' && <p className="text-sm text-foreground">Nothing — the search is their only focus right now.</p>}
      {view.state === 'unanswered' && (
        <p className="text-sm text-muted-foreground">Not answered yet. Worth asking if they take contract or other work while they search.</p>
      )}
    </div>
  )
}
