import Link from 'next/link'

// Compact "where you stand" status for the dashboard homepage — the full
// side-by-side tier comparison used to render here too, which is exactly
// the "you're already looking at the whole thing" duplication the
// membership page redesign was meant to fix. This just states the current
// state and points to the one real place to see options.
export function MembershipStatusLadder({ dossierUnlocked, reason }: { dossierUnlocked: boolean; reason: string }) {
  const currentLabel = dossierUnlocked ? 'Candidate+' : 'Candidate'

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm text-foreground">
        You&apos;re currently on <span className="font-semibold">{currentLabel}</span>
        {!dossierUnlocked && <span className="text-muted-foreground"> — {reason}</span>}.{' '}
        <Link href="/dashboard/membership" className="text-primary underline underline-offset-4">
          Get more support →
        </Link>
      </p>
    </div>
  )
}
