import { cn } from '@/lib/utils'

// NextChapter's branded loading indicator — a navy track with an orange
// arc, so an async wait reads as "this product is working," not a generic
// browser spinner. No logomark exists to animate (Logo.tsx is wordmark-only),
// so this is deliberately its own simple two-tone mark rather than an
// animated version of the wordmark. motion-safe: respects
// prefers-reduced-motion by not spinning at all for users who've asked for
// reduced motion — the two-tone ring still reads as "loading" while static.
export function Spinner({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn('motion-safe:animate-spin', className)}
      role="status"
      aria-label="Loading"
    >
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="var(--color-navy)" strokeOpacity="0.15" strokeWidth="3" />
      <path
        d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5"
        fill="none"
        stroke="var(--color-orange)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

// Inline "spinner + label" row for a section that's still generating —
// drop-in replacement for the plain text-only "X is generating — check
// back in a moment" copy used across report pages, so the wait has a
// visible working signal instead of just static text.
export function InlineLoadingState({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <Spinner size={16} />
      <span>{label}</span>
    </div>
  )
}

// Full-page centered spinner for route-level loading.tsx files.
export function PageLoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <Spinner size={32} />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
