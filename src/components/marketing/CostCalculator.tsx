'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'
import { INCUMBENT_COST_RANGES, volumeDiscountRate } from '@/lib/marketing/incumbent-cost-ranges'

type TierKey = 'outplacement_core' | 'outplacement_plus' | 'outplacement_premium'

const TIER_OPTIONS: { key: TierKey; label: string }[] = [
  { key: 'outplacement_core', label: 'Core' },
  { key: 'outplacement_plus', label: 'Plus' },
  { key: 'outplacement_premium', label: 'Premium' },
]

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

interface Props {
  prices: Record<TierKey, number | null>
}

// Partners Master Build Script §D2.4: "Add a cost calculator: seats ×
// tier, with an 'estimated incumbent cost' range beside it." Our own price
// is real (passed in from getCurrentPlan() via the server component that
// renders this) — the incumbent range is deliberately only as precise as
// the spec's own §A2.1 table, which is what INCUMBENT_COST_RANGES is
// sourced from. See docs/COMPETITIVE_CLAIMS_SUBSTANTIATION.md.
//
// Design principles: 3 discrete tier options render as adjacent buttons,
// not a dropdown; the result recalculates live as inputs change, which is
// the "immediate visible feedback" this interaction needs — there's
// nothing to submit.
export function CostCalculator({ prices }: Props) {
  const posthog = usePostHog()
  const [tier, setTier] = useState<TierKey>('outplacement_plus')
  const [seats, setSeats] = useState(25)

  const perSeatCents = prices[tier]
  const discountRate = volumeDiscountRate(seats)
  const incumbent = INCUMBENT_COST_RANGES[tier]

  const ourTotalCents = useMemo(() => {
    if (perSeatCents === null) return null
    return Math.round(perSeatCents * seats * (1 - discountRate))
  }, [perSeatCents, seats, discountRate])

  const incumbentLowTotal = incumbent.lowCents * seats
  const incumbentHighTotal = incumbent.highCents * seats

  function handleTierChange(next: TierKey) {
    setTier(next)
    posthog?.capture('cost_calculator_updated', { tier: next, seats })
  }

  function handleSeatsChange(next: number) {
    const clamped = Math.max(1, Math.min(2000, Math.round(next) || 1))
    setSeats(clamped)
  }

  function handleSeatsBlur() {
    posthog?.capture('cost_calculator_updated', { tier, seats })
  }

  return (
    <div className="rounded-xl border border-light-gray bg-off-white p-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-foreground" htmlFor="cost-calc-seats">
            Number of seats
          </label>
          <input
            id="cost-calc-seats"
            type="number"
            min={1}
            max={2000}
            value={seats}
            onChange={(e) => handleSeatsChange(Number(e.target.value))}
            onBlur={handleSeatsBlur}
            className="mt-2 w-32 rounded-md border border-border px-3 py-2 text-sm"
          />
          {discountRate > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Volume pricing applied: −{Math.round(discountRate * 100)}%
            </p>
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-foreground">Tier</p>
          <div className="mt-2 flex gap-2">
            {TIER_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => handleTierChange(opt.key)}
                aria-pressed={tier === opt.key}
                className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                  tier === opt.key
                    ? 'border-brand bg-brand text-white'
                    : 'border-border bg-white text-foreground hover:border-brand hover:text-brand'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-brand bg-white p-4">
          <p className="text-sm font-semibold text-brand">Estimated NextChapter cost</p>
          <p className="mt-1 text-2xl font-bold text-navy">
            {ourTotalCents !== null ? formatUsd(ourTotalCents) : '—'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {seats} seat{seats === 1 ? '' : 's'} · {TIER_OPTIONS.find((o) => o.key === tier)?.label} tier,
            published list price
          </p>
        </div>
        <div className="rounded-lg border border-border bg-white p-4">
          <p className="text-sm font-semibold text-foreground">Estimated incumbent cost</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {formatUsd(incumbentLowTotal)}
            {incumbent.highUnbounded ? '+' : `–${formatUsd(incumbentHighTotal)}`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Based on {incumbent.sourceLabel}, per the Partners Master Build Script&apos;s own competitive-context
            estimates — not an independently verified, current quote. See our{' '}
            <Link href="/vs" className="underline underline-offset-4">
              comparison pages
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
