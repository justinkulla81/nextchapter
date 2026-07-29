import { Skeleton } from '@/components/ui/skeleton'

// Prompt 66 — skeleton screen for the Stats page's heavier, full-page load
// (grade cards, trend graphs, activity heatmap), matching the eventual
// layout rather than a bare centered spinner. Overrides the parent
// app/dashboard/loading.tsx spinner for this route only.
export default function StatsLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <Skeleton className="h-20 w-full" />

      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>

      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-56 w-full" />
    </div>
  )
}
