import type { ReactNode } from 'react'
import { PartnerWordmark, type PartnerSurface } from '@/components/partners/PartnerWordmark'

// Partners Master Build Script §B3.1 — "chrome inversion," the primary
// orientation cue: a persistent navy, white-text top bar on every partner
// surface (candidate keeps its white/off-white bar, unchanged). Fixed at
// every breakpoint — mobile no longer gets a separate light-colored bar,
// it gets this one, with the nav-drawer trigger passed in as `children`
// by the caller (each *Nav component still owns the drawer's open state).
//
// Callers must offset both the fixed sidebar (`top-14`) and the page
// content (`pt-[6.5rem]` = this bar's h-14 + the original pt-12) to clear
// this bar's fixed height.
export function PartnerTopBar({ surface, children }: { surface: PartnerSurface; children?: ReactNode }) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between bg-navy px-4 lg:px-6">
      <PartnerWordmark surface={surface} className="text-base lg:text-lg" />
      {children}
    </header>
  )
}
