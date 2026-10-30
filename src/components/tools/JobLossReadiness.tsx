'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePostHog } from '@/lib/posthog/client'
import { buildReadiness, type Cover, type ReadinessResult } from '@/lib/tools/readiness'

const FIELD = 'mt-1 h-11 w-full rounded-lg border border-border bg-white px-3 text-base'
const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const months = (n: number) => `${Math.round(n * 10) / 10} months`
const num = (s: string) => Number(s.replace(/[$,\s]/g, ''))

export interface ReadinessState { code: string; slug: string; name: string; maxWeekly: number | null; minWeekly: number | null; maxWeeks: number | null; agency: string | null; fileUrl: string | null }

const COVER_OPTIONS: { key: Cover; label: string }[] = [
  { key: 'health', label: 'Health insurance' },
  { key: 'life', label: 'Life insurance' },
  { key: 'disability', label: 'Disability insurance' },
]

const BAND_COPY = {
  thin: 'A thin cushion. Under three months leaves little room to be choosy.',
  workable: 'Workable. Three to six months covers many searches, though a senior search often runs longer.',
  strong: 'Strong. More than six months gives you room to wait for the right role.',
} as const

// A what-if for someone who still has a job. Everything is worked out in the browser; dollar amounts are never sent or stored,
// and the analytics event carries only the state, the runway band and which cover they have.
export function JobLossReadiness({ states }: { states: ReadinessState[] }) {
  const posthog = usePostHog()
  const [state, setState] = useState('')
  const [pay, setPay] = useState('')
  const [savings, setSavings] = useState('')
  const [spend, setSpend] = useState('')
  const [severance, setSeverance] = useState('')
  const [work, setWork] = useState<Record<Cover, boolean>>({ health: true, life: false, disability: false })
  const [result, setResult] = useState<{ r: ReadinessResult; state: ReadinessState } | null>(null)
  const [error, setError] = useState<string | null>(null)

  function run(e: React.FormEvent) {
    e.preventDefault()
    const picked = states.find((s) => s.code === state)
    if (!picked) return setError('Pick the state you work in, so we can use its unemployment rules.')
    if (!(num(pay) > 0)) return setError('Enter your yearly pay, above zero.')
    if (!(num(spend) > 0)) return setError('Enter what you spend in a month, above zero.')
    if (num(savings) < 0 || num(severance) < 0) return setError('Savings and severance cannot be negative.')
    setError(null)
    const r = buildReadiness({
      annualPay: num(pay),
      savings: num(savings) || 0,
      monthlyExpenses: num(spend),
      severance: num(severance) || 0,
      state: picked,
      throughWork: work,
    })
    setResult({ r, state: picked })
    posthog?.capture('job_loss_readiness_run', { state: picked.code, band: r.band, hasHealth: work.health, hasLife: work.life, hasDisability: work.disability, hadSeverance: num(severance) > 0 })
  }

  return (
    <div className="mt-8 max-w-2xl space-y-6">
      <form onSubmit={run} className="space-y-4 rounded-xl border border-border bg-white p-6" noValidate>
        <label className="block text-sm font-medium text-navy">
          State where you work
          <select className={FIELD} value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">Choose a state</option>
            {states.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-navy">
          Yearly pay
          <input inputMode="decimal" className={FIELD} value={pay} onChange={(e) => setPay(e.target.value)} placeholder="95000" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-navy">
            Savings you could spend
            <input inputMode="decimal" className={FIELD} value={savings} onChange={(e) => setSavings(e.target.value)} placeholder="20000" />
          </label>
          <label className="block text-sm font-medium text-navy">
            What you spend each month
            <input inputMode="decimal" className={FIELD} value={spend} onChange={(e) => setSpend(e.target.value)} placeholder="6000" />
          </label>
        </div>
        <label className="block text-sm font-medium text-navy">
          Severance you would expect after tax (leave blank if none)
          <input inputMode="decimal" className={FIELD} value={severance} onChange={(e) => setSeverance(e.target.value)} placeholder="0" />
        </label>
        <fieldset>
          <legend className="text-sm font-medium text-navy">What you get through work today</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            {COVER_OPTIONS.map((c) => (
              <label key={c.key} className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" className="h-4 w-4" checked={work[c.key]} onChange={(e) => setWork((w) => ({ ...w, [c.key]: e.target.checked }))} />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button type="submit" className="inline-flex h-12 items-center rounded-full bg-action px-6 text-base font-semibold text-action-foreground hover:brightness-95">See my readiness</button>
        <p className="text-xs text-muted-foreground">Free, no account. Your numbers stay in this browser and are not saved.</p>
      </form>

      {result && <Result r={result.r} state={result.state} />}
    </div>
  )
}

function Result({ r, state }: { r: ReadinessResult; state: ReadinessState }) {
  const posthog = usePostHog()
  const weeks = r.ui?.weeks
  return (
    <div className="space-y-6" aria-live="polite">
      <section className="rounded-xl border border-border bg-white p-6">
        <h2 className="text-xl font-semibold tracking-tight text-navy">Your runway</h2>
        <p className="mt-2 text-base font-semibold text-navy">
          About {months(r.monthsWithoutBenefits)} from savings{r.ui ? `, ${months(r.monthsWithBenefits)} with unemployment benefits` : ''}.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{BAND_COPY[r.band]}</p>
        {r.gapToSixMonths > 0 && <p className="mt-1 text-sm text-muted-foreground">Six months of spending would take about {usd(r.gapToSixMonths)} more.</p>}
      </section>

      {r.ui && (
        <section className="rounded-xl border border-border bg-white p-6">
          <h2 className="text-xl font-semibold tracking-tight text-navy">What unemployment would pay</h2>
          <p className="mt-2 text-base font-semibold text-navy">
            About {usd(r.ui.weekly)} a week{weeks ? ` for up to ${weeks} weeks` : ''}
            {r.ui.cappedAtMax ? ` (${state.name}'s maximum)` : ''}.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            A planning estimate: half of your weekly pay, held between {state.name}&apos;s minimum and maximum. The state uses its own formula, so the real amount can be lower. Benefits are taxable.
          </p>
          <p className="mt-2 text-sm">
            <Link href={`/unemployment-benefits/${state.slug}`} className="text-brand underline underline-offset-4">{state.name} benefits and how to file</Link>
          </p>
        </section>
      )}

      {r.cover.length > 0 && (
        <section className="rounded-xl border border-border bg-white p-6">
          <h2 className="text-xl font-semibold tracking-tight text-navy">What ends the day the job does</h2>
          <ul className="mt-3 space-y-4">
            {r.cover.map((c) => (
              <li key={c.cover}>
                <p className="text-base font-semibold text-navy">
                  {c.title}{c.windowDays ? <span className="ml-2 rounded-full bg-off-white px-2 py-0.5 text-xs font-medium text-muted-foreground">{c.windowDays}-day window</span> : null}
                </p>
                <p className="mt-1 text-sm text-foreground">{c.ends}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.next}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">Windows are counted from your last day, the cautious way to plan. Your plan documents set the exact dates.</p>
        </section>
      )}

      <section className="rounded-xl border border-border bg-white p-6">
        <h2 className="text-xl font-semibold tracking-tight text-navy">Worth doing now</h2>
        <ol className="mt-3 space-y-4">
          {r.actions.map((a) => (
            <li key={a.id}>
              <p className="text-base font-semibold text-navy">{a.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
              {a.href && (
                <Link
                  href={a.href}
                  onClick={() => posthog?.capture('job_loss_readiness_action_clicked', { action: a.id, state: state.code, band: r.band })}
                  className="mt-1 inline-block text-sm font-medium text-brand underline underline-offset-4"
                >
                  {a.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
