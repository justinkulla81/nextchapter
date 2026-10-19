import Link from 'next/link'
import { TrackedLink } from '@/components/dashboard/TrackedLink'
import { STANCE_LABEL } from '@/lib/reports/market-reality-brief/evaluators'
import { firstStep } from '@/lib/reports/market-reality-brief/launchpad'
import type { MarketRealityBrief } from '@/lib/reports/market-reality-brief/load'
import type { WeeklyChange } from '@/lib/reports/market-reality-brief/weekly-change'

const ACTION = 'inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground hover:brightness-95'
const SECONDARY = 'inline-flex h-9 shrink-0 items-center rounded-full border border-border px-4 text-sm font-medium text-navy hover:bg-muted'

/**
 * The first view of the Market Reality Report: one verdict, three numbers, the three fixes that matter
 * most and how three readers will take the record. The long report is one click away (?view=full).
 * Every line is read from the same brief as the long report, so the two cannot disagree.
 */
export function BriefView({ brief, change }: { brief: MarketRealityBrief; change: WeeklyChange | null }) {
  const { summary, effort, evaluators } = brief
  const fixes = summary.priorities.slice(0, 3)
  const start = fixes[0] ?? null
  const next = firstStep(brief.launchpad)
  const verdict = summary.headline ?? summary.overallRead[0] ?? null
  const difficulty = summary.difficulty ? summary.difficulty.replace(' difficulty', '') : null

  const numbers: { value: string; label: string }[] = []
  if (difficulty) numbers.push({ value: difficulty.charAt(0).toUpperCase() + difficulty.slice(1), label: 'How hard this search is' })
  if (effort) {
    numbers.push({ value: `About ${effort.plan.conversationsPerInterview.toLocaleString()}`, label: 'Real conversations for one interview' })
    numbers.push(
      effort.plan.pace.activityObserved
        ? { value: `About ${Math.round(effort.plan.pace.expectedInterviews * 10) / 10}`, label: 'Interviews expected in 12 weeks at your pace' }
        : { value: 'Not yet known', label: 'Your pace: log activity or connect Gmail to see it' }
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="font-serif text-3xl leading-tight font-semibold tracking-tight text-navy">Your market reality</h1>
          <p className="max-w-xl text-base text-muted-foreground">How a recruiter, hiring manager and search firm will read you, and what to fix first.</p>
        </div>
        {(start || next) && (
          <TrackedLink
            href={(start ?? next)!.href}
            event="market_reality_start_clicked"
            properties={{ key: (start ?? next)!.key, surface: 'brief' }}
            className={ACTION}
          >
            {start ? 'Start with fix 1' : 'Start here'}
          </TrackedLink>
        )}
      </header>

      <section aria-labelledby="short" className="space-y-4 rounded-2xl border border-border bg-white p-6">
        <h2 id="short" className="font-serif text-xl font-semibold text-navy">The short version</h2>
        {verdict ? (
          <p className="text-lg text-foreground">{verdict}</p>
        ) : (
          <p className="text-base text-muted-foreground">
            There is not enough on file yet for a verdict.{' '}
            <Link href="/dashboard/resume" className="text-primary underline underline-offset-4">Upload a resume</Link> to start.
          </p>
        )}
        {numbers.length > 0 && (
          <dl className="grid gap-3 sm:grid-cols-3">
            {numbers.map((n) => (
              <div key={n.label} className="rounded-xl bg-muted/70 p-4">
                <dd className="text-2xl font-semibold text-navy">{n.value}</dd>
                <dt className="text-sm text-muted-foreground">{n.label}</dt>
              </div>
            ))}
          </dl>
        )}
        {change?.hasChange && (
          <p className="text-sm text-muted-foreground">
            Since last week: {change.headline}{' '}
            <Link href="?view=full#changed" className="text-primary underline underline-offset-4">See what moved</Link>
          </p>
        )}
      </section>

      {fixes.length > 0 && (
        <section aria-labelledby="fix" className="space-y-2">
          <h2 id="fix" className="font-serif text-xl font-semibold text-navy">Fix these first</h2>
          <ol className="divide-y divide-border rounded-2xl border border-border bg-white">
            {fixes.map((f, i) => (
              <li key={f.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="max-w-xl">
                  <p className="text-base font-semibold text-navy">{i + 1}. {f.title}</p>
                  <p className="text-sm text-muted-foreground">{f.rationale}</p>
                </div>
                <TrackedLink href={f.href} event="market_reality_action_clicked" properties={{ key: f.key, area: f.area, surface: 'brief' }} className={SECONDARY}>
                  {f.cta}
                </TrackedLink>
              </li>
            ))}
          </ol>
        </section>
      )}

      {evaluators.length > 0 && (
        <section aria-labelledby="read" className="space-y-2">
          <h2 id="read" className="font-serif text-xl font-semibold text-navy">How you will be read</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-white">
            {evaluators.map((e) => (
              <li key={e.key} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <span className="text-base font-semibold text-navy">{e.who}{e.stalls ? <span className="ml-2 text-sm font-normal text-muted-foreground">where your searches stall</span> : null}</span>
                <span className="text-base text-foreground">{STANCE_LABEL[e.stance]}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            One line each.{' '}
            <Link href="?view=full#read" className="text-primary underline underline-offset-4">See what each one asks and thinks</Link>
          </p>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-4 border-t border-border pt-5">
        <Link href="?view=full" className={SECONDARY}>Read the full report</Link>
        <span className="text-sm text-muted-foreground">Experience, skills, résumé, objections and how the ratings are set. Print or save it as a PDF from there.</span>
      </div>
    </div>
  )
}
