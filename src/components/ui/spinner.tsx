import { cn } from '@/lib/utils'

// NextChapter's branded loading indicator — a tile that flips from "N" to
// "C", so an async wait reads as "this product is working," not a generic
// browser spinner. No logomark exists to animate (Logo.tsx is wordmark-only),
// so this is deliberately its own simple mark rather than an animated
// version of the wordmark.
//
// Two independent, fixed CSS @keyframes loops on nested layers (see
// nc-flip/nc-spin in globals.css), synced to the same 10.6s duration —
// nc-flip is the Y-axis card-turn between the N/C faces; nc-spin is a
// separate Z-axis (in-plane) rotation applied to the layer wrapping the
// flip, so it reads as the whole tile cartwheeling flat against the screen
// rather than another card-turn. After the 2nd flip settles back on "N" the
// tile does one clockwise 360° spin; after the 3rd flip it does a
// counterclockwise 720° (double) spin; then the loop recycles. Not
// randomized per play, but varied enough across its length that it doesn't
// read as a strict metronome. motion-safe: respects prefers-reduced-motion
// by not animating at all — the tile stays on its "N" face, which still
// reads as a branded loading mark while static.
export function Spinner({ className, size = 20 }: { className?: string; size?: number }) {
  const fontSize = Math.round(size * 0.5)
  return (
    <span
      className={cn('inline-block', className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    >
      <span className="relative block h-full w-full [perspective:240px] motion-safe:animate-[nc-spin_10.6s_ease-in-out_infinite]">
        <span className="relative block h-full w-full [transform-style:preserve-3d] motion-safe:animate-[nc-flip_10.6s_ease-in-out_infinite]">
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

// Full-page centered spinner for route-level loading.tsx files. min-h is
// most of the viewport (not just 50vh) so it centers in the actual visible
// page instead of sitting near the top of it.
export function PageLoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-3">
      <Spinner size={48} />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
