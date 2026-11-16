import type { ReactNode } from 'react'
import { PORTAL_TYPES, portalTypeLabel, type PortalType } from '@/lib/partners/portal-types'
import type { PartnerBrand } from '@/lib/partners/brand'
import { PartnerBrandMark } from '@/components/partners/PartnerBrandMark'
import { readableTextOn } from '@/lib/higher-ed/branding'

// The top bar of every non-candidate portal: NextChapter wordmark, then the portal type in the portal's own color
// ("Employer · Outplacement"), then the customer's logo and name. Static here; the fixed-position wrapper that
// PartnerTopBar adds is a layout detail of the live pages.
// `chrome` overrides the bar color (a demo in the customer's own color); the text color is picked for contrast.
export function PortalTypeBar({ type, use, brand, chrome, children }: { type: PortalType; use?: string | null; brand?: PartnerBrand; chrome?: string | null; children?: ReactNode }) {
  const info = PORTAL_TYPES[type]
  const bg = chrome ?? info.chrome
  const fg = chrome ? readableTextOn(chrome) : '#ffffff'
  const hasBrand = !!brand && (brand.name || brand.logoUrl)
  return (
    <header
      aria-label={`${portalTypeLabel(type, use)} portal`}
      className="flex h-14 items-center justify-between gap-3 px-4 lg:px-6"
      style={{ backgroundColor: bg, color: fg, boxShadow: brand?.accent ? `inset 0 -3px 0 ${brand.accent}` : undefined }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0 text-base font-bold tracking-tight lg:text-lg">
          Next<span className="font-normal">Chapter</span>
        </span>
        <span aria-hidden="true" className="h-5 w-px shrink-0 bg-current opacity-40" />
        <span className="shrink-0 rounded-md px-2.5 py-1 text-sm font-semibold" style={{ backgroundColor: 'color-mix(in srgb, currentColor 15%, transparent)' }}>{portalTypeLabel(type, use)}</span>
        {hasBrand && brand && (
          <>
            <span aria-hidden="true" className="h-5 w-px shrink-0 bg-current opacity-25" />
            <PartnerBrandMark brand={brand} />
            {brand.name && <span className="hidden min-w-0 truncate text-sm font-medium sm:block">{brand.name}</span>}
          </>
        )}
      </div>
      {children}
    </header>
  )
}
