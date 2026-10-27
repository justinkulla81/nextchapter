'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePostHog } from '@/lib/posthog/client'
import { calculateSeverance, type SeveranceResult } from '@/lib/tools/severance'
import { agreementDates, netSeverance, TREATMENT_LABEL, TREATMENT_SENTENCE, type NetResult, type StateTreatment } from '@/lib/severance/calc'
import { WAIVER } from '@/lib/severance/rules'

const FIELD = 'mt-1 h-11 w-full rounded-lg border border-border bg-white px-3 text-base'
const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const weeks = (n: number) => `${Math.round(n * 10) / 10} ${n === 1 ? 'week' : 'weeks'}`
const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

/** One state's severance rule for unemployment, passed in from the server so this file does not carry the 3,000-line state data. */
export interface CalculatorState {
  code: string
  name: string
  slug: string
  treatment: StateTreatment
  text: string | null
}

interface Computed {
  gross: SeveranceResult
  low: NetResult
  high: NetResult
}

/**
 * The severance calculator: the common weeks-per-year formula as a range, then what is left after the federal withholding and payroll taxes we can
 * source (src/lib/severance/rules.ts), then, if asked, a state's unemployment rule and the review dates of an agreement. No account, nothing stored.
 * Every assumption is printed under the numbers.
 */
export function SeveranceCalculator({ states }: { states: CalculatorState[] }) {
  const posthog = usePostHog()
  const [pay, setPay] = useState('')
  const [years, setYears] = useState('')
  const [rate, setRate] = useState('')
  const [months, setMonths] = useState('')
  const [cobra, setCobra] = useState('')
  const [paidThisYear, setPaidThisYear] = useState('')
  const [stateTax, setStateTax] = useState('')
  const [stateCode, setStateCode] = useState('')
  const [received, setReceived] = useState('')
  const [group, setGroup] = useState<'individual' | 'group'>('individual')
  const [result, setResult] = useState<Computed | null>(null)
  const [error, setError] = useState<string | null>(null)

  const picked = states.find((s) => s.code === stateCode) ?? null
  const receivedDate = received ? new Date(`${received}T00:00:00Z`) : null
  const dates = receivedDate && !Number.isNaN(receivedDate.getTime()) ? agreementDates(receivedDate, group === 'group') : null

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
    const earlier = paidThisYear ? Number(paidThisYear.replace(/[$,]/g, '')) : 0
    const stateRatePercent = stateTax ? Number(stateTax) : 0
    setResult({
      gross: r,
      low: netSeverance({ gross: r.low, paidThisYear: earlier, stateRatePercent }),
      high: netSeverance({ gross: r.high, paidThisYear: earlier, stateRatePercent }),
    })
    posthog?.capture('severance_calculator_run', {
      yearsBand: yearsOfService < 3 ? 'under_3' : yearsOfService < 10 ? '3_9' : '10_plus',
      usedOwnRate: !!rate,
      includedCoverage: !!(months && cobra),
      state: stateCode || null,
      addedStateTax: !!stateTax,
      addedEarlierPay: !!paidThisYear,
      hadAgreementDate: !!dates,
    })
  }

  const same = result && result.gross.low === result.gross.high
  const lines: { label: string; pick: (n: NetResult) => number; minus?: boolean }[] = [
    { label: 'Before taxes', pick: (n) => n.gross },
    { label: 'Federal income tax withheld', pick: (n) => n.federalIncomeTax, minus: true },
    { label: 'Social Security', pick: (n) => n.socialSecurity, minus: true },
    { label: 'Medicare', pick: (n) => n.medicare, minus: true },
    { label: 'Additional Medicare', pick: (n) => n.additionalMedicare, minus: true },
    { label: 'State income tax (your rate)', pick: (n) => n.stateIncomeTax, minus: true },
    { label: 'You receive, about', pick: (n) => n.net },
  ]

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

      <fieldset className="space-y-4 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-semibold text-navy">For the take-home estimate (optional)</legend>
        <label className="block text-sm font-medium text-navy">
          Pay you already earned this year, before the severance
          <input inputMode="decimal" className={FIELD} value={paidThisYear} onChange={(e) => setPaidThisYear(e.target.value)} placeholder="Blank means none" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-navy">
            Your state
            <select
              className={FIELD}
              value={stateCode}
              onChange={(e) => {
                setStateCode(e.target.value)
                if (e.target.value) posthog?.capture('severance_state_selected', { state: e.target.value })
              }}
            >
              <option value="">Choose a state</option>
              {states.map((s) => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-navy">
            State income tax withheld, percent
            <input inputMode="decimal" className={FIELD} value={stateTax} onChange={(e) => setStateTax(e.target.value)} placeholder="Blank leaves it out" />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-semibold text-navy">Reviewing an agreement (optional)</legend>
        <label className="block text-sm font-medium text-navy">
          Date you received the final offer
          <input type="date" className={FIELD} value={received} onChange={(e) => setReceived(e.target.value)} />
        </label>
        <div role="group" aria-label="Kind of offer" className="flex gap-2">
          {(['individual', 'group'] as const).map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={group === g}
              onClick={() => setGroup(g)}
              className={`h-10 flex-1 rounded-full border px-4 text-sm font-medium ${group === g ? 'border-navy bg-navy text-white' : 'border-border bg-white text-navy hover:bg-off-white'}`}
            >
              {g === 'individual' ? 'Just me' : 'Part of a group layoff'}
            </button>
          ))}
        </div>
        {dates && (
          <p className="text-sm text-navy" aria-live="polite">
            If you are {WAIVER.minAge} or older, you have until <span className="font-semibold">{dateFmt.format(dates.reviewEnds)}</span> ({dates.reviewDays} days) to decide, and {WAIVER.revokeDays} days after you sign to revoke. A material change to the
            offer restarts the {dates.reviewDays} days.
          </p>
        )}
      </fieldset>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" className="inline-flex h-12 items-center rounded-full bg-action px-6 text-base font-semibold text-action-foreground hover:brightness-95">
        Calculate severance
      </button>

      {result && (
        <div className="space-y-4" aria-live="polite">
          <div className="rounded-lg bg-off-white p-4 text-sm">
            <p className="text-base font-semibold text-navy">
              {same ? usd(result.gross.low) : `${usd(result.gross.low)} to ${usd(result.gross.high)}`} before taxes
            </p>
            <p className="mt-1 text-muted-foreground">
              {same ? weeks(result.gross.lowWeeks) : `${weeks(result.gross.lowWeeks)} to ${weeks(result.gross.highWeeks)}`} of pay at {usd(result.gross.weeklyPay)} a week.
              {result.gross.coverageValue > 0 && ` Paid health coverage is worth about ${usd(result.gross.coverageValue)} more.`}
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Estimated withholding and take-home pay</caption>
              <thead className="bg-off-white text-navy">
                <tr>
                  <th className="px-3 py-2 font-semibold">If paid as a lump sum</th>
                  <th className="px-3 py-2 text-right font-semibold">{same ? 'Amount' : 'Low end'}</th>
                  {!same && <th className="px-3 py-2 text-right font-semibold">High end</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lines.map((l, i) => {
                  const lowV = l.pick(result.low)
                  const highV = l.pick(result.high)
                  const last = i === lines.length - 1
                  if (l.minus && lowV === 0 && highV === 0) return null
                  return (
                    <tr key={l.label} className={last ? 'font-semibold text-navy' : undefined}>
                      <td className="px-3 py-2">{l.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.minus ? '−' : ''}{usd(lowV)}</td>
                      {!same && <td className="px-3 py-2 text-right tabular-nums">{l.minus ? '−' : ''}{usd(highV)}</td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {result.low.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {picked && (
        <div className="rounded-lg border border-border bg-off-white p-4 text-sm" aria-live="polite">
          <p className="font-semibold text-navy">Unemployment in {picked.name}</p>
          {picked.treatment ? (
            <>
              <p className="mt-1 text-navy">{TREATMENT_LABEL[picked.treatment]}. {TREATMENT_SENTENCE[picked.treatment]}</p>
              {picked.text && <p className="mt-1 text-muted-foreground">{picked.text}</p>}
            </>
          ) : (
            <p className="mt-1 text-muted-foreground">Official sources disagree on how {picked.name} counts severance, so we do not guess. Ask the state agency before you sign.</p>
          )}
          <p className="mt-2">
            <Link href={`/unemployment-benefits/${picked.slug}`} className="text-brand underline underline-offset-4" onClick={() => posthog?.capture('severance_state_page_clicked', { state: picked.code })}>
              {picked.name}: benefits, the rule and its source
            </Link>
          </p>
        </div>
      )}
    </form>
  )
}
