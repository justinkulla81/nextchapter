import type { ReactNode } from 'react'
import { PortalTypeBar } from '@/components/partners/PortalTypeBar'
import type { PartnerBrand } from '@/lib/partners/brand'
import type { PortalType } from '@/lib/partners/portal-types'
import { cn } from '@/lib/utils'

// The frame for the partner-page previews (src/app/dev-preview/marketing/*): a portal's top bar in its own color,
// a quiet left menu, and the screen inside. Every figure, name and company in these previews is invented sample data,
// and the top bar says so. scripts/marketing/render-screenshots.mjs renders them to public/marketing/*.webp for the
// public partner pages (src/components/marketing/PortalMarketingPage.tsx). Nothing here is live.

export const SAMPLE_BRANDS = {
  higher_ed: { name: 'Riverside College', logoUrl: null, accent: '#d9b84a' },
  workforce: { name: 'Tri-County Workforce Board', logoUrl: null, accent: '#7fb7e0' },
  employer: { name: 'Northwind Foods', logoUrl: null, accent: '#f4a259' },
  recruiter: { name: 'Hartley Search', logoUrl: null, accent: '#e07a5f' },
} satisfies Record<string, PartnerBrand>

export function SampleTag() {
  return <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">Sample data</span>
}

export function PortalFrame({
  type,
  use,
  brand,
  nav,
  active,
  trail,
  children,
}: {
  type: PortalType
  use?: string
  brand: PartnerBrand
  nav: string[]
  active: string
  trail?: string
  children: ReactNode
}) {
  return (
    <div className="theme-candidate theme-redesign w-[1440px] bg-white text-ink" data-shot>
      <PortalTypeBar type={type} use={use} brand={brand}>
        <SampleTag />
      </PortalTypeBar>
      <div className="flex min-h-[780px]">
        <aside className="w-60 shrink-0 border-r border-border px-4 py-6" aria-label="Portal menu">
          <nav className="space-y-1">
            {nav.map((label) => (
              <span
                key={label}
                aria-current={label === active ? 'page' : undefined}
                className={cn('block rounded-md border-l-[3px] px-2 py-2 text-sm font-semibold', label === active ? 'border-ink bg-muted text-ink' : 'border-transparent text-ink/80')}
              >
                {label}
              </span>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 px-10 py-8">
          <div className="space-y-8">
            {trail && <p className="text-sm text-muted-foreground">{trail}</p>}
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export function Title({ children, intro, action }: { children: ReactNode; intro?: string; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1.5">
        <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight text-ink">{children}</h1>
        {intro && <p className="max-w-2xl text-base text-muted-foreground">{intro}</p>}
      </div>
      {action}
    </header>
  )
}

export const Action = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground">{children}</span>
)

export const Quiet = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium text-ink">{children}</span>
)

export function Panel({ title, why, children, className }: { title: string; why?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-3 rounded-2xl border border-border p-5', className)}>
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      {why && <p className="text-sm text-muted-foreground">Why: {why}</p>}
      {children}
    </section>
  )
}

export function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-ink">{value}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}

export function Pill({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'good' | 'warm' | 'ink' }) {
  const t = { muted: 'bg-muted text-muted-foreground', good: 'bg-success/10 text-success', warm: 'bg-orange/20 text-ink', ink: 'bg-ink text-white' }[tone]
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', t)}>{children}</span>
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-muted-foreground">
          {head.map((h) => (
            <th key={h} className="px-2 py-2 font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-border tabular-nums">
            {r.map((c, j) => (
              <td key={j} className="px-2 py-2.5">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function Bar({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-border" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
    </div>
  )
}
