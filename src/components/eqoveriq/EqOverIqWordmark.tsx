import { cn } from '@/lib/utils'

// EQoverIQ's own wordmark — deliberately its own brand, not the
// NextChapter logo, same technical pattern as CrucibleWordmark but a
// distinct palette for a different, more senior audience: restrained
// amber/champagne accent instead of NEN's neon cyan/magenta/lime, since
// this product is styled after Mercor/Micro1's understated professionalism
// rather than a teaser-challenge's high-energy tone. `dark` matches the
// landing page's near-black background; the plain variant is tuned for
// white headers used inside the contributor portal.
export function EqOverIqWordmark({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <span className={cn('font-[family-name:var(--font-fraunces)] font-semibold tracking-tight', className)}>
      {dark ? (
        <>
          <span className="text-[#F5F3EF]">EQ</span>
          <span className="font-normal text-[#F5F3EF]/45">over</span>
          <span className="text-[#C9A227]">IQ</span>
        </>
      ) : (
        <>
          <span className="text-foreground">EQ</span>
          <span className="font-normal text-muted-foreground">over</span>
          <span className="text-[#9C7A1A]">IQ</span>
        </>
      )}
    </span>
  )
}
