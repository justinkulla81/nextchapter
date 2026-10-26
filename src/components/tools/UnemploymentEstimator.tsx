'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePostHog } from '@/lib/posthog/client'
import { estimateUi, type UiEstimate } from '@/lib/tools/ui-estimate'

const FIELD = 'mt-1 h-11 w-full rounded-lg border border-border bg-white px-3 text-base'
const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export interface EstimatorState { code: string; slug: string; name: string; maxWeekly: number | null; minWeekly: number | null; maxWeeks: number | null; agency: string | null; fileUrl: string | null }

export function UnemploymentEstimator({ states }: { states: EstimatorState[] }) {
  const posthog = usePostHog()
  const [pay, setPay] = useState('')
  const [code, setCode] = useState('')
  const [result, setResult] = useState<{ est: UiEstimate; state: EstimatorState } | null>(null)
  const [error, setError] = useState<string | null>(null)

  function run(e: React.FormEvent) {
    e.preventDefault()
    const state = states.find((s) => s.code === code)
    const annual = Number(pay.replace(/[$,]/g, ''))
    if (!state) return setError('Pick the state you worked in.')
    if (!(annual > 0)) return setError('Enter your yearly pay, above zero.')
    const est = estimateUi({ annualPay: annual, maxWeekly: state.maxWeekly, minWeekly: state.minWeekly, maxWeeks: state.maxWeeks })
    if (!est) return setError('Enter your yearly pay, above zero.')
    setError(null)
    setResult({ est, state })
    posthog?.capture('unemployment_estimator_run', { state: state.code, cappedAtMax: est.cappedAtMax })
  }

  return (
    <form onSubmit={run} className="mt-8 max-w-xl space-y-4 rounded-xl border border-border bg-white p-6" noValidate>
      <label className="block text-sm font-medium text-navy">
        State where you worked
        <select className={FIELD} value={code} onChange={(e) => setCode(e.target.value)}>
          <option value="">Choose a state</option>
          {states.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium text-navy">
        Yearly pay before the layoff
        <input inputMode="decimal" className={FIELD} value={pay} onChange={(e) => setPay(e.target.value)} placeholder="85000" />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" className="inline-flex h-12 items-center rounded-full bg-action px-6 text-base font-semibold text-action-foreground hover:brightness-95">Estimate my benefits</button>
      {result && (
        <div className="rounded-lg bg-off-white p-4 text-sm" aria-live="polite">
          <p className="text-base font-semibold text-navy">About {usd(result.est.weekly)} a week{result.est.weeks ? ` for up to ${result.est.weeks} weeks` : ''}{result.est.total ? `, up to ${usd(result.est.total)} in all` : ''}</p>
          <p className="mt-1 text-muted-foreground">
            {result.est.cappedAtMax ? `That is ${result.state.name}'s maximum weekly benefit. ` : ''}This is a planning estimate: half of your weekly pay, held between the state’s minimum and maximum. {result.state.name} uses its own formula, so the amount it pays can be lower.
          </p>
          <p className="mt-2 text-muted-foreground">
            <Link href={`/unemployment-benefits/${result.state.slug}`} className="text-brand underline underline-offset-4">{result.state.name} benefits and how to file</Link>
            {result.state.fileUrl && <> · <a href={result.state.fileUrl} className="text-brand underline underline-offset-4" target="_blank" rel="noopener noreferrer">file with {result.state.agency ?? 'the state'}</a></>}
          </p>
        </div>
      )}
    </form>
  )
}
