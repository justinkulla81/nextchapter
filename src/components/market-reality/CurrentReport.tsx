import Link from 'next/link'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Module } from '@/components/candidate/Module'
import { Chip } from '@/components/candidate/ui'
import { ShowMore } from '@/components/candidate/ShowMore'
import { TrackedLink } from '@/components/dashboard/TrackedLink'
import { PrintReportButton } from '@/components/dashboard/PrintReportButton'
import { RegenerateReport } from '@/components/market-reality/RegenerateReport'
import { AiAtWorkBlock } from '@/components/candidate/AiAtWork'
import type { AiAtWork } from '@/lib/skills/ai-at-work'
import type { CurrentRead } from '@/lib/reports/market-reality-brief/current-report'

const LINK = 'text-sm font-medium text-brand underline underline-offset-4'

// The one market report, in the redesigned look (docs/candidate-redesign.md): one headline, one primary
// action, three sections on the first view, the rest behind "Show more". Every line carries the fact it rests
// on. No letter grade and no verdict label; the page is always the member's position as of now.
export function CurrentReport({
  read,
  aiAtWork,
  asOf,
  lastGeneratedAt,
  regen,
}: {
  read: CurrentRead
  /** Occupation exposure and openings split; null when unavailable (nothing is shown then). */
  aiAtWork?: AiAtWork | null
  asOf: Date
  lastGeneratedAt: Date | null
  regen: { allowed: boolean; message: string }
}) {
  const date = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const firstSteps = read.steps.slice(0, 3)
  const laterSteps = read.steps.slice(3)
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        title={read.headline}
        intro={`As of ${date(asOf)}. ${read.because}`}
        action={<RegenerateReport allowed={regen.allowed} message={regen.message} />}
      />

      <Module title="What is working for you">
        {read.inPlace.length === 0 ? (
          <p className="text-base text-ink">Nothing is counted yet. Each answer you give and each tool you use adds a line here, with the fact behind it.</p>
        ) : (
          <ul className="divide-y divide-border">
            {read.inPlace.slice(0, 4).map((r) => (
              <li key={r.key} className="space-y-0.5 py-3 first:pt-0 last:pb-0">
                <p className="text-base font-semibold text-ink">{r.title}</p>
                <p className="text-sm text-muted-foreground">{r.fact}</p>
              </li>
            ))}
          </ul>
        )}
        {read.market && (
          <p className="border-t border-border pt-4 text-base text-ink">
            <span className="font-semibold">{read.market.line}</span> <span className="text-sm text-muted-foreground">{read.market.fact}</span>
          </p>
        )}
        <AiAtWorkBlock data={aiAtWork ?? null} surface="market_reality" />
      </Module>

      <Module title="Your first steps">
        {firstSteps.length === 0 ? (
          <p className="text-base text-ink">Every step on your twelve-week list is done. Regenerate when you have something new to add.</p>
        ) : (
          <ol className="divide-y divide-border">
            {firstSteps.map((s) => (
              <li key={s.key} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 max-w-xl space-y-0.5">
                  <p className="text-base font-semibold text-ink">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.because}</p>
                  {s.lockedNote && <p className="text-sm text-ink">{s.lockedNote}</p>}
                </div>
                <TrackedLink
                  href={s.href}
                  event="market_report_step_clicked"
                  properties={{ key: s.key, phase: s.phase, area: s.area, surface: 'first_steps' }}
                  className={LINK}
                >
                  {s.lockedNote ? 'See what turns it on' : `Open ${s.tool}`}
                  {s.minutes ? ` (about ${s.minutes} min)` : ''}
                </TrackedLink>
              </li>
            ))}
          </ol>
        )}
      </Module>

      <Module title="Questions to be ready for">
        {read.questions.length === 0 ? (
          <p className="text-base text-ink">Nothing on file raises a question an employer is likely to ask.</p>
        ) : (
          <ul className="divide-y divide-border">
            {read.questions.map((q) => (
              <li key={q.question} className="space-y-1 py-3 first:pt-0 last:pb-0">
                <p className="text-base font-semibold text-ink">{q.question}</p>
                <p className="text-sm text-muted-foreground">{q.answer}</p>
              </li>
            ))}
          </ul>
        )}
      </Module>

      <ShowMore label="Show the rest of the report" event="market_report_show_more_toggled" properties={{ toBuild: read.toBuild.length, laterSteps: laterSteps.length }}>
        {read.toBuild.length > 0 && (
          <Module title="Next to build">
            <ul className="divide-y divide-border">
              {read.toBuild.map((r) => (
                <li key={r.key} className="space-y-1 py-3 first:pt-0 last:pb-0">
                  <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
                    {r.title} <Chip>{r.status}</Chip>
                  </p>
                  <p className="text-sm text-muted-foreground">{r.fact}</p>
                  {r.next && r.href && (
                    <p className="text-sm text-ink">
                      {r.next}{' '}
                      <TrackedLink href={r.href} event="market_report_step_clicked" properties={{ key: r.key, surface: 'next_to_build' }} className={LINK}>
                        Open {r.tool}
                      </TrackedLink>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Module>
        )}
        {laterSteps.length > 0 && (
          <Module title="The rest of your twelve weeks">
            <ol className="divide-y divide-border">
              {laterSteps.map((s) => (
                <li key={s.key} className="space-y-0.5 py-3 first:pt-0 last:pb-0">
                  <p className="text-base font-semibold text-ink">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.because}</p>
                </li>
              ))}
            </ol>
          </Module>
        )}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <Link href="/dashboard/market" className={LINK}>
            Widen your market
          </Link>
          <PrintReportButton event="market_report_printed" properties={{ inPlace: read.inPlace.length, toBuild: read.toBuild.length }} />
          <span>{lastGeneratedAt ? `Resume rewrites and weekly plan last refreshed ${date(lastGeneratedAt)}.` : 'Resume rewrites and weekly plan are not generated yet.'}</span>
        </div>
      </ShowMore>
    </div>
  )
}
