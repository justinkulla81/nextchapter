'use client'

import { useState } from 'react'
import { usePostHog } from '@/lib/posthog/client'
import { calculateRunway, type RunwayResult } from '@/lib/tools/runway'

const FIELD = 'mt-1 h-11 w-full rounded-lg border border-border bg-white px-3 text-base'
const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const months = (n: number) => `${Math.round(n * 10) / 10} months`
const num = (s: string) => Number(s.replace(/[$,]/g, ''))

export interface RunwayState { code: string; name: string; maxWeekly: number | null; maxWeeks: number | null }

export function LayoffRunway({ states }: { states: RunwayState[] }) {
  const posthog = usePostHog()
  const [savings, setSavings] = useState('')
  const [spend, setSpend] = useState('')
  const [severance, setSeverance] = useState('')
  const [state, setState] = useState('')
  const [weekly, setWeekly] = useState('')
  const [benefitWeeks, setBenefitWeeks] = useState('')
  const [result, setResult] = useState<RunwayResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const picked = states.find((s) => s.code === state)

  function pick(code: string) {
    setState(code)
    const s = states.find((x) => x.code === code)
    setWeekly(s?.maxWeekly ? String(s.maxWeekly) : '')
    setBenefitWeeks(s?.maxWeeks ? String(s.maxWeeks) : '')
  }

  function run(e: React.FormEvent) {
    e.preventDefault()
    if (!(num(spend) > 0)) return setError('Enter what you spend in a month, above zero.')
    if (num(savings) < 0 || num(severance) < 0) return setError('Savings and severance cannot be negative.')
    setError(null)
    const r = calculateRunway({ savings: num(savings) || 0, monthlyExpenses: num(spend), severance: num(severance) || 0, weeklyBenefit: num(weekly) || 0, benefitWeeks: num(benefitWeeks) || 0 })
    setResult(r)
    posthog?.capture('layoff_runway_run', { state: state || null, usedBenefits: num(weekly) > 0, hadSeverance: num(severance) > 0 })
  }

  return (
    <form onSubmit={run} className="mt-8 max-w-xl space-y-4 rounded-xl border border-border bg-white p-6" noValidate>
      <label className="block text-sm font-medium text-navy">
        Savings you can spend
        <input inputMode="decimal" className={FIELD} value={savings} onChange={(e) => setSavings(e.target.value)} placeholder="20000" />
      </label>
      <label className="block text-sm font-medium text-navy">
        What you spend each month
        <input inputMode="decimal" className={FIELD} value={spend} onChange={(e) => setSpend(e.target.value)} placeholder="4500" />
      </label>
      <label className="block text-sm font-medium text-navy">
        Severance you expect, after tax (leave blank for none)
        <input inputMode="decimal" className={FIELD} value={severance} onChange={(e) => setSeverance(e.target.value)} />
      </label>
      <label className="block text-sm font-medium text-navy">
        Your state (fills in unemployment benefits at the state maximum)
        <select className={FIELD} value={state} onChange={(e) => pick(e.target.value)}>
          <option value="">Not counting unemployment benefits</option>
          {states.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
        </select>
      </label>
      {state && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-navy">
            Weekly benefit
            <input inputMode="decimal" className={FIELD} value={weekly} onChange={(e) => setWeekly(e.target.value)} />
          </label>
          <label className="block text-sm font-medium text-navy">
            Weeks it lasts
            <input inputMode="numeric" className={FIELD} value={benefitWeeks} onChange={(e) => setBenefitWeeks(e.target.value)} />
          </label>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            {picked?.maxWeekly ? `${picked.name} pays at most ${usd(picked.maxWeekly)} a week${picked.maxWeeks ? ` for up to ${picked.maxWeeks} weeks` : ''}.` : `${picked?.name} has no confirmed maximum on file.`} Most people receive less than the maximum, so lower the weekly figure to match your own.
          </p>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" className="inline-flex h-12 items-center rounded-full bg-action px-6 text-base font-semibold text-action-foreground hover:brightness-95">Work out my runway</button>
      {result && (
        <div className="rounded-lg bg-off-white p-4 text-sm" aria-live="polite">
          <p className="text-base font-semibold text-navy">{months(result.monthsWithoutBenefits)} of spending covered by your own money</p>
          {result.benefitsTotal > 0 && (
            <p className="mt-1 text-muted-foreground">With unemployment benefits of up to {usd(result.benefitsTotal)} counted: <strong className="text-navy">{months(result.monthsWithBenefits)}</strong>.</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Spending is held level, and taxes on benefits and the cost of health coverage are not included. Add coverage to your monthly spending to see its effect.</p>
        </div>
      )}
    </form>
  )
}
