import { Skeleton } from '@/components/ui/skeleton'

// Placeholder for a slow section that streams in behind its own Suspense
// boundary. The page shell paints first; this holds the section's place and
// tells assistive tech what is loading.
export function SectionSkeleton({ label, lines = 3 }: { label: string; lines?: number }) {
  return (
    <div role="status" aria-busy="true" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={i === lines - 1 ? 'h-4 w-1/2' : 'h-4 w-full'} />
      ))}
    </div>
  )
}
