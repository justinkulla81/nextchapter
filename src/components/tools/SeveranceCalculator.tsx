'use client'

import { useState } from 'react'
import { usePostHog } from '@/lib/posthog/client'
import { calculateSeverance, type SeveranceResult } from '@/lib/tools/severance'

const FIELD = 'mt-1 h-11 w-full rounded-lg border border-border bg-white px-3 text-base'
const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const weeks = (n: number) => `${Math.round(n * 10) / 10} ${n === 1 ? 'week' : 'weeks'}`

export function SeveranceCalculator() {
  const posthog = usePostHog()
  const [pay, setPay] = useState('')
  const [years, setYears] = useState('')
  const [rate, setRate] = useState('')
  const [months, setMonths] = useState('')
  const [cobra, setCobra] = useState('')
  const [result, setResult] = useState<SeveranceResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function run(e: React.FormEvent) {
    e.preventDefault()
    const annualPay = Number(pay.replace(/[$,]/g, ''))
    const yearsOfService = Number(years)
    if (!(annualPay > 0) || !(yearsOfService > 0)) {
      setError('Enter your annual pay and your years of service, both above zero.')
      return
    }
    setError(null)
    const r = calculateSeverance({
      annualPay,
      yearsOfService,
      weeksPerYear: rate ? Number(rate) : null,
      coverageMonths: months ? Number(months) : 0,
      cobraMonthly: cobra ? Number(cobra.replace(/[$,]/g, '')) : 0,
    })
    setResult(r)
    posthog?.capture('severance_calculator_run', {
      yearsBand: yearsOfService < 3 ? 'under_3' : yearsOfService < 10 ? '3_9' : '10_plus',
      usedOwnRate: !!rate,
      includedCoverage: !!(months && cobra),
    })
  }

  return (
    <form onSubmit={run} className="mt-8 max-w-xl space-y-4 rounded-xl border border-border bg-white p-6" noValidate>
      <label className="block text-sm font-medium text-navy">
        Annual base pay
        <input inputMode="decimal" className={FIELD} value={pay} onChange={(e) => setPay(e.target.value)} placeholder="120000" />
      </label>
      <label className="block text-sm font-medium text-navy">
        Years of service
        <input inputMode="decimal" className={FIELD} value={years} onChange={(e) => setYears(e.target.value)} placeholder="6" />
      </label>
      <label className="block text-sm font-medium text-navy">
        Weeks of pay per year in your offer (leave blank to see 1 to 2)
        <input inputMode="decimal" className={FIELD} value={rate} onChange={(e) => setRate(e.target.value)} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-navy">
          Months of paid health coverage
          <input inputMode="numeric" className={FIELD} value={months} onChange={(e) => setMonths(e.target.value)} />
        </label>
        <label className="block text-sm font-medium text-navy">
          COBRA premium per month
          <input inputMode="decimal" className={FIELD} value={cobra} onChange={(e) => setCobra(e.target.value)} />
        </label>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" className="inline-flex h-12 items-center rounded-full bg-action px-6 text-base font-semibold text-action-foreground hover:brightness-95">
        Calculate severance
      </button>
      {result && (
        <div className="rounded-lg bg-off-white p-4 text-sm" aria-live="polite">
          <p className="text-base font-semibold text-navy">
            {result.low === result.high ? usd(result.low) : `${usd(result.low)} to ${usd(result.high)}`} before taxes
          </p>
          <p className="mt-1 text-muted-foreground">
            {result.lowWeeks === result.highWeeks ? weeks(result.lowWeeks) : `${weeks(result.lowWeeks)} to ${weeks(result.highWeeks)}`} of pay at {usd(result.weeklyPay)} a week.
            {result.coverageValue > 0 && ` Paid health coverage is worth about ${usd(result.coverageValue)} more.`}
          </p>
        </div>
      )}
    </form>
  )
}
