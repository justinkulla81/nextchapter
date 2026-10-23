import { PortalTypeBar } from '@/components/partners/PortalTypeBar'
import { PORTAL_TYPE_ORDER, PORTAL_TYPES, type PortalType } from '@/lib/partners/portal-types'
import type { PartnerBrand } from '@/lib/partners/brand'

// Sample customers only. The type color is fixed by portal; the customer's own color is only the thin rule under the bar.
const SAMPLES: Record<PortalType, { use?: string; brand: PartnerBrand }> = {
  employer: { use: 'Outplacement', brand: { name: 'Northwind Foods', logoUrl: null, accent: '#f4a259' } },
  higher_ed: { use: 'Career services', brand: { name: 'Riverside College', logoUrl: null, accent: '#d9b84a' } },
  workforce: { use: 'Economic development', brand: { name: 'Tri-County Workforce Board', logoUrl: null, accent: '#7fb7e0' } },
  recruiter: { brand: { name: 'Hartley Search', logoUrl: null, accent: '#e07a5f' } },
  coach: { brand: { name: 'Maya Ortiz Coaching', logoUrl: null, accent: '#8ab17d' } },
}

function Page({ type }: { type: PortalType }) {
  const s = SAMPLES[type]
  return (
    <div className="overflow-hidden rounded-lg border border-light-gray bg-white">
      <PortalTypeBar type={type} use={s.use} brand={s.brand}>
        <span className="hidden shrink-0 whitespace-nowrap text-sm text-white/80 md:block">Dana Whitfield</span>
      </PortalTypeBar>
      <div className="space-y-2 px-6 py-6">
        <h2 className="font-display text-xl font-semibold text-ink">{PORTAL_TYPES[type].label} home</h2>
        <p className="text-sm text-muted-foreground">Page content goes here, in the same look as the candidate site.</p>
      </div>
    </div>
  )
}

export function PortalHeaders() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <p className="text-sm text-muted-foreground">
        Each portal has its own top-bar color and a fixed label naming it, so a person always knows which portal they are in. The customer’s own logo and name follow the label; their color is the thin rule under the bar. Colors are sample choices.
      </p>
      {PORTAL_TYPE_ORDER.map((t) => (
        <Page key={t} type={t} />
      ))}
    </div>
  )
}
