import { cn } from '@/lib/utils'

// The noexperienceneeded.ai wordmark — deliberately its own brand, not the
// NextChapter logo (see CrucibleLayout's font-scoping comment: /noexperience
// runs its own visual system). `dark` matches the landing page's near-black
// background; the plain variant is tuned for the white headers used on
// /noexperience/test, /full, and /lesson — same hues, contrast-checked
// against white instead of relying on the dark variant's text-shadow glow.
export function CrucibleWordmark({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <span className={cn('font-[family-name:var(--font-jetbrains-mono)] font-bold tracking-tight', className)}>
      {dark ? (
        <>
          <span className="text-[#C8FF1A] [text-shadow:0_0_10px_rgba(200,255,26,0.55)]">no</span>
          <span className="font-normal text-[#F5F3EE]/40">experience</span>
          <span className="text-[#FF2E9A] [text-shadow:0_0_10px_rgba(255,46,154,0.55)]">needed</span>
          <span className="text-[#2EE6FF]">.ai</span>
        </>
      ) : (
        <>
          <span className="text-foreground">no</span>
          <span className="font-normal text-muted-foreground">experience</span>
          <span className="text-[#C2168A]">needed</span>
          <span className="text-[#1478C8]">.ai</span>
        </>
      )}
    </span>
  )
}
