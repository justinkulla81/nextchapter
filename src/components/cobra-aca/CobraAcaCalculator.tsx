'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DeadlineEmailBox } from '@/components/cobra-aca/DeadlineEmailBox'
import { LaidOffStart } from '@/components/cobra-aca/LaidOffStart'
import { compare, deadlines, money, type CompareResult, type CoverageYear, type Deadlines } from '@/lib/cobra-aca/calc'
import { MARKETPLACE_LABEL, STATE_FACTS } from '@/lib/cobra-aca/states'
import { MARKETPLACE, PTC } from '@/lib/cobra-aca/rules'
import { parseLastDay, plausibleLastDay } from '@/lib/tools/layoff-deadlines'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

const FIELD = 'mt-1 h-11 w-full rounded-lg border border-border bg-white px-3 text-base'
const day = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

interface Result {
  compare: CompareResult
  dates: Deadlines
  state: string
  coverageYear: CoverageYear
  lastDay: string
}

const num = (raw: string): number => Number(raw.replace(/[$,\s]/g, ''))

/**
 * COBRA vs Marketplace, side by side, from the person's own numbers. Worked out in the browser (no AI, nothing stored). The credit estimate
 * follows the IRS tables in src/lib/cobra-aca/rules.ts and says it is an estimate. The email box and the journey question come after the result.
 */
export function CobraAcaCalculator({ initialState = '', journeyChoices }: { initialState?: string; journeyChoices: { slug: string; label: string }[] }) {
  const [coverageYear, setCoverageYear] = useState<CoverageYear>(2026)
  const [state, setState] = useState(initialState)
  // A link from a state page (?state=TX) preselects the state. Read after load so the server-rendered page stays the same for everyone.
  useEffect(() => {
    if (initialState) return
    const q = new URLSearchParams(window.location.search).get('state')?.toUpperCase()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only: the query string is not available when the page is rendered
    if (q && (ALL_STATE_CODES as readonly string[]).includes(q)) setState(q)
  }, [initialState])
  const [size, setSize] = useState('1')
  const [income, setIncome] = useState('')
  const [cobra, setCobra] = useState('')
  const [quote, setQuote] = useState('')
  const [lastDay, setLastDay] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  function run(e: React.FormEvent) {
    e.preventDefault()
    const ld = parseLastDay(lastDay)
    const inc = num(income)
    const cob = num(cobra)
    if (!state) return fail('Choose your state.')
    if (!Number.isFinite(inc) || inc < 0 || income.trim() === '') return fail('Enter your expected household income for the year, in dollars. Use 0 if you expect none.')
    if (!Number.isFinite(cob) || cob <= 0) return fail('Enter the monthly COBRA premium on your notice. If you have not got it yet, ask your plan administrator.')
    if (!ld || !plausibleLastDay(ld)) return fail('Enter the date your job-based coverage ends, within the last 60 days or the next 30.')
    const noticeDate = notice ? parseLastDay(notice) : null
    const q = quote.trim() === '' ? null : num(quote)
    if (q !== null && (!Number.isFinite(q) || q < 0)) return fail('Enter the Marketplace premium as a number, or leave it blank.')
    setError(null)
    const r = compare({ coverageYear, state, householdSize: Number(size), annualIncome: inc, cobraMonthly: cob, marketplaceMonthly: q })
    setResult({ compare: r, dates: deadlines(ld, noticeDate), state, coverageYear, lastDay })
    posthog.capture('cobra_vs_aca_calculated', { state, coverageYear, householdSize: Number(size), eligibility: r.eligibility, usedQuote: r.marketplaceSource === 'quote', cheaper: r.monthlyDifference > 0 ? 'marketplace' : 'cobra' })
  }
  function fail(message: string) {
    setError(message)
    setResult(null)
  }

  return (
    <div className="mt-8 max-w-2xl space-y-6">
      <form onSubmit={run} noValidate className="space-y-4 rounded-xl border border-border bg-white p-6">
        <fieldset>
          <legend className="text-sm font-medium text-navy">Which year will the new coverage be in?</legend>
          <div className="mt-2 flex gap-2" role="group">
            {([2026, 2027] as const).map((y) => (
              <button
                key={y}
                type="button"
                aria-pressed={coverageYear === y}
                onClick={() => setCoverageYear(y)}
                className={cn('h-11 flex-1 rounded-lg border px-4 text-sm font-semibold', coverageYear === y ? 'border-action bg-action text-action-foreground' : 'border-border bg-white text-navy hover:bg-off-white')}
              >
                {y === 2026 ? 'Rest of 2026' : 'Starting in 2027'}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Coverage from now through December uses the 2026 rules; open enrollment for 2027 starts November 1 and uses the 2027 rules.</p>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-navy">
            Your state
            <select className={FIELD} value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">Choose a state</option>
              {ALL_STATE_CODES.map((c) => (
                <option key={c} value={c}>{stateName(c)}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-navy">
            People in your household
            <select className={FIELD} value={size} onChange={(e) => setSize(e.target.value)}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-navy">
            Expected household income this year
            <input inputMode="numeric" className={FIELD} value={income} onChange={(e) => setIncome(e.target.value)} placeholder="e.g. 48,000" />
            <span className="mt-1 block text-xs font-normal text-muted-foreground">Everyone in the household: pay you have already earned this year, severance, unemployment benefits and any other income.</span>
          </label>
          <label className="block text-sm font-medium text-navy">
            Monthly COBRA premium on your notice
            <input inputMode="numeric" className={FIELD} value={cobra} onChange={(e) => setCobra(e.target.value)} placeholder="e.g. 1,150" />
          </label>
          <label className="block text-sm font-medium text-navy">
            Marketplace plan premium, if you have a quote (optional)
            <input inputMode="numeric" className={FIELD} value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="Blank = your state’s typical plan" />
          </label>
          <label className="block text-sm font-medium text-navy">
            Date your job-based coverage ends
            <input type="date" className={FIELD} value={lastDay} onChange={(e) => setLastDay(e.target.value)} />
          </label>
          <label className="block text-sm font-medium text-navy sm:col-span-2">
            Date your COBRA notice arrived, if it came after your coverage ended (optional)
            <input type="date" className={FIELD} value={notice} onChange={(e) => setNotice(e.target.value)} />
          </label>
        </div>

        <Button type="submit" className="h-11 rounded-full bg-action px-6 text-action-foreground hover:brightness-95">
          Compare my options
        </Button>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>

      {result && <Output r={result} journeyChoices={journeyChoices} />}
    </div>
  )
}

function Output({ r, journeyChoices }: { r: Result; journeyChoices: { slug: string; label: string }[] }) {
  const c = r.compare
  const facts = STATE_FACTS[r.state]
  const name = stateName(r.state)
  const table = PTC[r.coverageYear]
  const cheaper = c.monthlyDifference
  return (
    <div role="status" className="space-y-6">
      <section className="space-y-4 rounded-xl border border-border bg-white p-6">
        <h2 className="text-xl font-bold text-navy">Your estimate</h2>

        {c.eligibility === 'medicaid' && (
          <p className="text-base text-navy">
            At about {Math.round(c.fplPct)}% of the poverty line, {facts.medicaidExpansion ? `${name} expanded Medicaid, so you may qualify for Medicaid` : `${name} covers adults up to 100% of the poverty line through a waiver, so you may qualify for Medicaid`}. Medicaid is decided on your income this month, not the year. You can apply at any time, and it can cost nothing. Check before you pay for COBRA.
          </p>
        )}
        {c.eligibility === 'gap' && (
          <p className="text-base text-navy">
            At about {Math.round(c.fplPct)}% of the poverty line in {name}, which has not expanded Medicaid, adults generally get neither Medicaid nor Marketplace credits. COBRA, or a Marketplace plan at full price, may be your only options. Ask your state Medicaid office; the rules for parents and for people with disabilities differ.
          </p>
        )}

        {(c.eligibility === 'credit' || c.eligibility === 'no-credit') && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">COBRA</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-navy">{money(c.cobraMonthly)}<span className="text-sm font-normal text-muted-foreground"> a month</span></p>
                <p className="mt-1 text-xs text-muted-foreground">Your same plan and doctors. Up to 18 months after a job loss.</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Marketplace {c.marketplaceSource === 'quote' ? '(your quote)' : `(typical ${name} plan)`}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-navy">{money(c.marketplaceAfterCreditMonthly)}<span className="text-sm font-normal text-muted-foreground"> a month</span></p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.creditMonthly > 0 ? `${money(c.marketplaceMonthly)} before an estimated ${money(c.creditMonthly)} a month credit.` : `${money(c.marketplaceMonthly)}, with no credit at this income.`}
                </p>
              </div>
            </div>
            <p className="text-base text-navy">
              {cheaper > 5
                ? `On these numbers the Marketplace plan costs about ${money(cheaper)} a month less than COBRA, about ${money(cheaper * 12)} over a year.`
                : cheaper < -5
                  ? `On these numbers COBRA costs about ${money(-cheaper)} a month less than the Marketplace plan.`
                  : 'On these numbers the two cost about the same each month.'}{' '}
              Price is not the only difference: COBRA keeps your plan, your doctors and what you have already paid toward this year’s deductible. A Marketplace plan means a new network and a new deductible.
            </p>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>
                Your income is about {Math.round(c.fplPct)}% of the {table.fplYear} poverty guideline ({money(c.fplAmount)} for your household).{' '}
                {c.eligibility === 'credit' && c.expectedShareOfIncome !== null
                  ? `The ${table.coverageYear} IRS table expects you to pay about ${(c.expectedShareOfIncome * 100).toFixed(1)}% of income for the benchmark plan; the credit covers the rest.`
                  : `The credit ends above 400% of the poverty line (${money(c.cliffIncome)} for your household). You are ${money(-c.headroomToCliff)} over it.`}
              </li>
              {c.eligibility === 'credit' && (
                <li>
                  You are {money(c.headroomToCliff)} under the point where the credit ends ({money(c.cliffIncome)}). Income counts for the whole year, so severance and unemployment benefits count too.
                </li>
              )}
              <li>If you enroll in COBRA you generally cannot get the Marketplace credit for those months. Cancelling COBRA yourself before it ends does not open a special enrollment window; open enrollment, or COBRA ending, does.</li>
              <li>{name} {MARKETPLACE_LABEL[facts.marketplace]}.</li>
            </ul>
          </>
        )}

        <p className="text-xs text-muted-foreground">
          This is an estimate, not advice. It uses IRS Rev. Proc. {r.coverageYear === 2026 ? '2025-25' : '2026-26'} and moves the percentage in a straight line within each income band; your tax return uses the exact figure from IRS Form 8962. It does not include cost-sharing reductions, state subsidies or plan differences. Benchmark premiums are KFF averages for a 40-year-old and your actual premium depends on your age and plan.{' '}
          <Link href="/resources/cobra-aca#sources" className="text-brand underline underline-offset-4">Sources</Link>.
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-white p-6">
        <h2 className="text-xl font-bold text-navy">Your dates</h2>
        <ol className="space-y-3">
          <li className="border-l-4 border-action pl-4">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{day(r.dates.cobraElectBy)}</p>
            <p className="font-semibold text-navy">Last day to elect COBRA</p>
            <p className="text-sm text-muted-foreground">You have 60 days from the later of when coverage ends and when you get the notice. If you elect, the first payment is due within 45 days of electing, by {day(r.dates.cobraFirstPaymentBy)} at the latest. Coverage is then back-dated to the day yours ended.</p>
          </li>
          <li className="border-l-4 border-action pl-4">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{day(r.dates.marketplaceBy)}</p>
            <p className="font-semibold text-navy">Last day to join a Marketplace plan outside open enrollment</p>
            <p className="text-sm text-muted-foreground">
              You have {MARKETPLACE.specialEnrollmentDays} days after your coverage ends. Pick before it ends and the plan can start {day(r.dates.marketplaceStartIfPickedBefore)}; pick on the last day and it starts {day(r.dates.marketplaceStartIfPickedLastDay)}. You then have {MARKETPLACE.documentDays} days to send documents.
            </p>
          </li>
        </ol>
        <p className="text-xs text-muted-foreground">Dates are counted from the day you entered. Confirm the exact dates on your COBRA notice and at HealthCare.gov or your state marketplace.</p>
      </section>

      <DeadlineEmailBox source="cobra_vs_aca:tool" state={r.state} lastDay={r.lastDay} journeyChoices={journeyChoices} />

      <section className="rounded-xl border border-border bg-white p-6">
        <p className="text-base font-semibold text-navy">Health insurance is one deadline of many.</p>
        <p className="mt-1 text-sm text-muted-foreground">A free Market Reality Assessment shows how the market reads your résumé and gives you a weekly plan that starts with the dates that matter.</p>
        <div className="mt-4">
          <LaidOffStart placement="tool_result" />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          More on {name}: <Link href={`/resources/cobra-aca/${stateSlug(r.state)}`} className="text-brand underline underline-offset-4">COBRA vs ACA in {name}</Link> and <Link href={`/unemployment-benefits/${stateSlug(r.state)}`} className="text-brand underline underline-offset-4">unemployment benefits in {name}</Link>.
        </p>
      </section>
    </div>
  )
}

