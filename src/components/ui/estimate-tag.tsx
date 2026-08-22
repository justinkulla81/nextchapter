import { cn } from '@/lib/utils'

// Every band, weight, window, and threshold in the Market Reality
// probability engine (src/lib/scoring/market-reality/probability.ts,
// attempts.ts, calibration.ts) is a first-pass estimate, not fit to real
// usage data yet — this tag is the one place that caveat is written, so it
// can never drift into five slightly different phrasings across the pages
// that show these numbers. Native `title` tooltip rather than a new Radix/
// base-ui tooltip primitive — no tooltip component exists yet in this
// codebase, and one hover string doesn't justify adding one.
export function EstimateTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'ml-1.5 inline-flex cursor-help items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground',
        className
      )}
      title="This gets more precise as more candidates use the product — treat it as a working estimate, not a fixed rule."
    >
      estimate
    </span>
  )
}
