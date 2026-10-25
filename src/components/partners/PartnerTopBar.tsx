import type { ReactNode } from 'react'
import { PartnerWordmark, type PartnerSurface } from '@/components/partners/PartnerWordmark'
import { PartnerBrandMark } from '@/components/partners/PartnerBrandMark'
import type { PartnerBrand } from '@/lib/partners/brand'
import { PORTAL_TYPES, portalTypeLabel, type PortalType } from '@/lib/partners/portal-types'

// The persistent top bar on every non-candidate portal (candidate keeps its white bar). Each portal type has its
// own chrome color and a fixed label naming it ("Employer · Outplacement"), so a person always knows which portal
// they are in (src/lib/partners/portal-types.ts). The customer's logo and name follow the label; their color is the
// thin rule under the bar, an inset shadow, so the bar keeps its exact height. Mobile gets this same bar, with the
// nav-drawer trigger passed in as `children` by the caller (each *Nav component owns the drawer's open state).
// Internal admin keeps the plain navy bar.
//
// Callers must offset both the fixed sidebar (`top-14`) and the page content (`pt-[6.5rem]` = this bar's h-14 +
// the original pt-12) to clear this bar's fixed height.
const SURFACE_PORTAL: Partial<Record<PartnerSurface, PortalType>> = { coach: 'coach', recruiter: 'recruiter', employer: 'employer' }

/** Chrome color of a portal's sidebar, matching its top bar. Admin stays navy. */
export function chromeFor(surface: PartnerSurface): string {
  const type = SURFACE_PORTAL[surface]
  return type ? PORTAL_TYPES[type].chrome : '#0b2545'
}

// `switcher` is the employer section switcher (adjacent buttons for the sections the person holds); other portals pass none.
export function PartnerTopBar({ surface, use, brand, switcher, children }: { surface: PartnerSurface; use?: string; brand?: PartnerBrand; switcher?: ReactNode; children?: ReactNode }) {
  const hasBrand = !!brand && (brand.name || brand.logoUrl)
  const type = SURFACE_PORTAL[surface]
  return (
    <header
      aria-label={type ? `${portalTypeLabel(type, use)} portal` : undefined}
      className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between gap-3 px-4 lg:px-6"
      style={{ backgroundColor: chromeFor(surface), ...(brand?.accent ? { boxShadow: `inset 0 -3px 0 ${brand.accent}` } : {}) }}
    >
      <div className="flex min-w-0 items-center gap-3">
        {type ? (
          <>
            <span className="shrink-0 text-base font-bold tracking-tight text-white lg:text-lg">
              Next<span className="font-normal">Chapter</span>
            </span>
            <span aria-hidden="true" className="h-5 w-px shrink-0 bg-white/40" />
            <span className="shrink-0 rounded-md bg-white/15 px-2.5 py-1 text-sm font-semibold text-white">{portalTypeLabel(type, use)}</span>
          </>
        ) : (
          <PartnerWordmark surface={surface} className="shrink-0 text-base lg:text-lg" />
        )}
        {switcher && <div className="hidden md:block">{switcher}</div>}
        {hasBrand && brand && (
          <>
            <span aria-hidden="true" className="h-5 w-px shrink-0 bg-white/25" />
            <PartnerBrandMark brand={brand} />
            {brand.name && <span className="hidden min-w-0 truncate text-sm font-medium text-white sm:block">{brand.name}</span>}
          </>
        )}
      </div>
      {children}
    </header>
  )
}
