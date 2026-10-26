'use client'

import { useState } from 'react'
import { usePostHog } from '@/lib/posthog/client'
import { FULL_TIME, PERIODS, PERIOD_LABEL, convertAll, validSchedule, type Period } from '@/lib/tools/salary-convert'

const FIELD = 'mt-1 h-11 w-full rounded-lg border border-border bg-white px-3 text-base'
const usd = (n: number, cents = false) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents ? 2 : 0, minimumFractionDigits: cents ? 2 : 0 })

export function SalaryConverter() {
  const posthog = usePostHog()
  const [amount, setAmount] = useState('')
  const [from, setFrom] = useState<Period>('hour')
  const [hours, setHours] = useState(String(FULL_TIME.hoursPerWeek))
  const [weeks, setWeeks] = useState(String(FULL_TIME.weeksPerYear))
  const [result, setResult] = useState<Record<Period, number> | null>(null)
  const [error, setError] = useState<string | null>(null)

  function run(e: React.FormEvent) {
    e.preventDefault()
    const n = Number(amount.replace(/[$,]/g, ''))
    const schedule = { hoursPerWeek: Number(hours), weeksPerYear: Number(weeks) }
    if (!(n > 0)) return setError('Enter the pay you want to convert, above zero.')
    if (!validSchedule(schedule)) return setError('Hours per week must be between 1 and 100, and weeks per year between 1 and 52.')
    setError(null)
    setResult(convertAll(n, from, schedule))
    posthog?.capture('salary_converter_run', { from, fullTime: schedule.hoursPerWeek === 40 && schedule.weeksPerYear === 52 })
  }

  return (
    <form onSubmit={run} className="mt-8 max-w-xl space-y-4 rounded-xl border border-border bg-white p-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-navy">
          Pay
          <input inputMode="decimal" className={FIELD} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="32" />
        </label>
        <label className="block text-sm font-medium text-navy">
          Paid
          <select className={FIELD} value={from} onChange={(e) => setFrom(e.target.value as Period)}>
            {PERIODS.map((p) => <option key={p} value={p}>{PERIOD_LABEL[p]}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-navy">
          Hours per week
          <input inputMode="decimal" className={FIELD} value={hours} onChange={(e) => setHours(e.target.value)} />
        </label>
        <label className="block text-sm font-medium text-navy">
          Weeks paid per year
          <input inputMode="decimal" className={FIELD} value={weeks} onChange={(e) => setWeeks(e.target.value)} />
        </label>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" className="inline-flex h-12 items-center rounded-full bg-action px-6 text-base font-semibold text-action-foreground hover:brightness-95">Convert</button>
      {result && (
        <dl className="rounded-lg bg-off-white p-4 text-sm" aria-live="polite">
          {PERIODS.map((p) => (
            <div key={p} className="flex justify-between gap-3 border-t border-border py-1.5 first:border-t-0">
              <dt className={p === from ? 'font-semibold text-navy' : 'text-muted-foreground'}>{PERIOD_LABEL[p]}</dt>
              <dd className={`tabular-nums ${p === from ? 'font-semibold text-navy' : ''}`}>{usd(result[p], p === 'hour' || p === 'day')}</dd>
            </div>
          ))}
        </dl>
      )}
    </form>
  )
}
