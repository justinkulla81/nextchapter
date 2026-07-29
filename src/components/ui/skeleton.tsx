import { cn } from '@/lib/utils'

// Prompt 66 — gray placeholder shapes for heavier, full-page content loads
// (Stats page graphs/heatmap, Dossier full render), matching the eventual
// layout rather than a centered Spinner alone on an empty page. Use Spinner
// (src/components/ui/spinner.tsx) for short async actions instead — these
// two patterns are deliberately not interchangeable, see the comment there.
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('motion-safe:animate-pulse rounded-md bg-muted', className)} />
}
