'use client'

import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { seniorityGroupLabel as groupLabel } from '@/lib/jobs/job-seniority'
import { PAY_VS_MARKET_LABEL, formatUsdK, marketBasisLabel, type PayVsMarket } from '@/lib/pay/market-pay'
import type { OpeningView } from '@/lib/companies/hiring-index-data'

// Open and past openings for one company, with each job's pay against market.
// Shared by the candidate company page and the admin / CRM company views.

const PAGE = 8
type Tab = 'open' | 'past'

const monthYear = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })

const VERDICT_STYLE: Record<PayVsMarket, string> = {
  above: 'bg-success/10 text-success',
  in_line: 'bg-muted text-muted-foreground',
  below: 'bg-warning/10 text-warning',
}

export function PayVsMarketBadge({ verdict, marketLow, marketHigh }: { verdict: PayVsMarket; marketLow: number | null; marketHigh: number | null }) {
  const range = marketLow && marketHigh ? `Market range for this role: ${formatUsdK(marketLow)}–${formatUsdK(marketHigh)}` : undefined
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', VERDICT_STYLE[verdict])} title={range}>
      {PAY_VS_MARKET_LABEL[verdict]}
    </span>
  )
}

function OpeningPay({ o }: { o: OpeningView }) {
  if (o.payMin && o.payMax) {
    return (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-foreground">
          {o.payMin === o.payMax ? formatUsdK(o.payMin) : `${formatUsdK(o.payMin)}–${formatUsdK(o.payMax)}`} posted
        </span>
        {o.payVsMarket && <PayVsMarketBadge verdict={o.payVsMarket} marketLow={o.marketLow} marketHigh={o.marketHigh} />}
      </span>
    )
  }
  if (o.marketLow && o.marketHigh) {
    return (
      <span title={marketBasisLabel(o.marketBasis, o.marketSample) ?? undefined}>
        No pay posted · market for this role {formatUsdK(o.marketLow)}–{formatUsdK(o.marketHigh)} (estimate)
      </span>
    )
  }
  return <span>No pay posted</span>
}

// The pay of one opening in words, with the reason: the market range it was compared with, or that a figure is an estimate.
function openingPayText(o: OpeningView): string {
  const market = o.marketLow && o.marketHigh ? `${formatUsdK(o.marketLow)} to ${formatUsdK(o.marketHigh)}` : null
  if (o.payMin && o.payMax) {
    const posted = o.payMin === o.payMax ? formatUsdK(o.payMin) : `${formatUsdK(o.payMin)} to ${formatUsdK(o.payMax)}`
    const verdict = o.payVsMarket ? `${PAY_VS_MARKET_LABEL[o.payVsMarket]}${market ? `: similar roles are posted at ${market}` : ''}` : null
    return `${posted} posted${verdict ? `. ${verdict}.` : '.'}`
  }
  if (market) return `No pay posted. Our estimate for this role is ${market}, from salaries posted for similar roles.`
  return 'No pay posted.'
}

export function CompanyOpeningsList({
  companyId,
  viewer,
  open,
  past,
  openTotal,
  pastTotal,
  redesign = false,
}: {
  companyId: string
  viewer: 'candidate' | 'admin' | 'crm'
  open: OpeningView[]
  past: OpeningView[]
  openTotal: number
  pastTotal: number
  redesign?: boolean
}) {
  const [tab, setTab] = useState<Tab>(openTotal > 0 || pastTotal === 0 ? 'open' : 'past')
  const [expanded, setExpanded] = useState(false)
  const rows = tab === 'open' ? open : past
  const total = tab === 'open' ? openTotal : pastTotal
  const visible = expanded ? rows : rows.slice(0, PAGE)

  function selectTab(next: Tab) {
    if (next === tab) return
    setTab(next)
    setExpanded(false)
    posthog.capture('company_openings_tab_selected', { companyId, tab: next, viewer, openTotal, pastTotal })
  }

  function expand() {
    setExpanded(true)
    posthog.capture('company_past_openings_expanded', { companyId, tab, viewer, total, shown: rows.length })
  }

  if (redesign) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Which openings to show">
          {(
            [
              ['open', `Open now (${openTotal.toLocaleString('en-US')})`],
              ['past', `Past (${pastTotal.toLocaleString('en-US')})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={tab === key}
              onClick={() => selectTab(key)}
              className={cn(
                'inline-flex h-10 items-center rounded-full border px-5 text-sm font-medium select-none',
                tab === key ? 'border-ink bg-ink text-white' : 'border-border text-ink hover:bg-muted'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="max-w-2xl text-base text-muted-foreground">
            {tab === 'open' ? 'No open roles on record right now.' : 'No closed openings on record yet. Past roles appear here once a listing comes down.'}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((o) => (
              <li key={o.id} className="space-y-1 py-4 first:pt-0">
                <a
                  href={o.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => posthog.capture('company_opening_clicked', { companyId, openingId: o.id, tab, viewer })}
                  className="inline-flex items-center gap-1 text-base font-semibold text-ink hover:underline"
                >
                  {o.title}
                  <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <span className="sr-only">(opens the original listing)</span>
                </a>
                <p className="text-base text-muted-foreground">
                  {[
                    o.location,
                    groupLabel(o.seniorityGroup),
                    o.closedAt ? `${o.closedLabel ?? 'Closed'}, open ${monthYear(o.openedAt)} to ${monthYear(o.closedAt)}` : `Posted ${monthYear(o.openedAt)}`,
                    o.repostLine,
                  ]
                    .filter(Boolean)
                    .join('. ')}
                  .
                </p>
                <p className="text-base text-ink">{openingPayText(o)}</p>
              </li>
            ))}
          </ul>
        )}

        {!expanded && rows.length > PAGE && (
          <button type="button" onClick={expand} className="text-base font-medium text-brand underline underline-offset-4">
            Show {rows.length < total ? `the latest ${rows.length}` : `all ${rows.length}`}
          </button>
        )}
        {expanded && rows.length < total && (
          <p className="text-sm text-muted-foreground">
            Showing the latest {rows.length} of {total.toLocaleString('en-US')}.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2" role="group" aria-label="Which openings to show">
        {(
          [
            ['open', `Open now (${openTotal.toLocaleString('en-US')})`],
            ['past', `Past (${pastTotal.toLocaleString('en-US')})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => selectTab(key)}
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm font-medium',
              tab === key ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:bg-muted'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {tab === 'open'
            ? 'No open roles on record right now.'
            : 'No closed openings on record yet. Past roles appear here once a listing comes down.'}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {visible.map((o) => (
            <li key={o.id} className="space-y-1 p-3">
              <a
                href={o.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => posthog.capture('company_opening_clicked', { companyId, openingId: o.id, tab, viewer })}
                className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
              >
                {o.title}
                <ExternalLink className="size-3 text-muted-foreground" aria-hidden="true" />
                <span className="sr-only">(opens the original listing)</span>
              </a>
              <p className="text-xs text-muted-foreground">
                {[
                  o.location,
                  groupLabel(o.seniorityGroup),
                  o.closedAt ? `${o.closedLabel ?? 'Closed'} · open ${monthYear(o.openedAt)} – ${monthYear(o.closedAt)}` : `Posted ${monthYear(o.openedAt)}`,
                  o.repostLine,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <p className="text-xs text-muted-foreground">
                <OpeningPay o={o} />
              </p>
            </li>
          ))}
        </ul>
      )}

      {!expanded && rows.length > PAGE && (
        <button type="button" onClick={expand} className="text-sm font-medium text-primary underline underline-offset-4">
          Show {rows.length < total ? `the latest ${rows.length}` : `all ${rows.length}`}
        </button>
      )}
      {expanded && rows.length < total && (
        <p className="text-xs text-muted-foreground">
          Showing the latest {rows.length} of {total.toLocaleString('en-US')}.
        </p>
      )}
    </div>
  )
}
