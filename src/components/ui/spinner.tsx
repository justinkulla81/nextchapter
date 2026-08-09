import { cn } from '@/lib/utils'

// NextChapter's branded loading indicator — a tile that flips from "N" to
// "C", so an async wait reads as "this product is working," not a generic
// browser spinner. No logomark exists to animate (Logo.tsx is wordmark-only),
// so this is deliberately its own simple mark rather than an animated
// version of the wordmark. motion-safe: respects prefers-reduced-motion by
// not flipping at all for users who've asked for reduced motion — the tile
// stays on its "N" face, which still reads as a branded loading mark while
// static.
export function Spinner({ className, size = 20 }: { className?: string; size?: number }) {
  const fontSize = Math.round(size * 0.5)
  return (
    <span
      className={cn('inline-block [perspective:240px]', className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    >
      <span className="relative block h-full w-full [transform-style:preserve-3d] motion-safe:animate-[nc-flip_2.2s_ease-in-out_infinite]">
        <span
          className="absolute inset-0 flex items-center justify-center rounded-[0.2em] font-medium text-white [backface-visibility:hidden]"
          style={{ background: 'var(--color-navy)', fontSize }}
        >
          N
        </span>
        <span
          className="absolute inset-0 flex items-center justify-center rounded-[0.2em] font-medium [backface-visibility:hidden] [transform:rotateY(180deg)]"
          style={{ background: 'var(--color-orange)', color: 'var(--color-navy)', fontSize }}
        >
          C
        </span>
      </span>
    </span>
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
      <Spinner size={48} />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
