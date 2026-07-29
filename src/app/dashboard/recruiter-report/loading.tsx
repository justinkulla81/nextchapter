import { Skeleton } from '@/components/ui/skeleton'

// Prompt 66 — skeleton screen for the Executive Dossier's heavier,
// full-page render, matching the eventual document layout rather than a
// bare centered spinner.
export default function RecruiterReportLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <div className="space-y-6 rounded-xl border border-border p-8">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  )
}
