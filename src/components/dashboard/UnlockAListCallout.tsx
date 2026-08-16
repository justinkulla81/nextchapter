// Sits directly under the locked A-List teaser cards on the Jobs page — a
// one-line signal of exactly what's blocking their Dossier unlock, without a
// wall of extra explanation the candidate already sees on their dashboard.
// `reason` is the plain-language gap from isDossierUnlocked() (e.g. "Need: 2
// more completed references.").
export function UnlockAListCallout({ reason, lockedCount }: { reason: string; lockedCount: number }) {
  const opportunityWord = lockedCount === 1 ? 'opportunity' : 'opportunities'

  return (
    <div className="rounded-lg border border-orange/30 bg-orange/5 p-4">
      <p className="text-sm font-medium text-foreground">
        Unlock {lockedCount} exclusive {opportunityWord} when your Dossier unlocks. {reason}
      </p>
    </div>
  )
}
