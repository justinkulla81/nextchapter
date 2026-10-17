import { GRADE_LABEL } from '@/lib/scoring/grade'
import type { MarketRealityBrief } from '@/lib/reports/market-reality-brief/load'
import { AssessmentMark, Estimate, ReportLink, ReportSection, ReportTable, SubHeading } from './report-ui'

export function Letterhead({ name, asOf }: { name: string; asOf: Date }) {
  return (
    <header className="border-t-4 border-navy pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">NextChapter</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-navy">Market Reality Report</h1>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Prepared for {name}</p>
          <p>Data as of {asOf.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>
      <p className="mt-4 max-w-3xl text-xs leading-relaxed text-muted-foreground">
        Confidential. Prepared solely for the named candidate and not for distribution to employers or other third parties without
        the candidate&apos;s consent.
      </p>
    </header>
  )
}

export function ExecutiveSummary({ brief }: { brief: MarketRealityBrief }) {
  const { grade, difficulty, headline, scorecard, priorities } = brief.summary
  return (
    <ReportSection id="summary" title="Executive summary" className="border-t-0 pt-0">
      {grade && difficulty ? (
        <div className="grid gap-6 sm:grid-cols-[14rem_1fr]">
          <div>
            <SubHeading>Search difficulty</SubHeading>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-navy capitalize">{difficulty.replace(' difficulty', '')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Market Reality Grade {grade}, {GRADE_LABEL[grade].toLowerCase()}
              <Estimate />
            </p>
          </div>
          {headline && <p className="max-w-2xl text-[0.95rem] leading-relaxed text-foreground">{headline}</p>}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          There is not enough on file yet for an overall assessment.{' '}
          <ReportLink href="/dashboard/resume" event="market_reality_action_clicked" properties={{ key: 'upload_resume', area: 'Summary' }}>
            Upload a resume
          </ReportLink>{' '}
          to start.
        </p>
      )}

      <div>
        <SubHeading>Assessment by dimension</SubHeading>
        <ReportTable
          label="Assessment by dimension"
          head={['Dimension', 'Assessment', 'Basis']}
          className="mt-2"
          rows={scorecard.map((r) => ({
            key: r.dimension,
            cells: [
              <a key="d" href={`#${r.anchor}`} className="underline-offset-4 hover:underline">
                {r.dimension}
              </a>,
              <AssessmentMark key="a" value={r.assessment} />,
              <span key="b" className="text-muted-foreground">
                {r.basis}
              </span>,
            ],
          }))}
        />
      </div>

      <div>
        <SubHeading>Priority actions</SubHeading>
        {priorities.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing is flagged. Keep the weekly rhythm going and re-read this report as the search develops.</p>
        ) : (
          <ol className="mt-3 space-y-4">
            {priorities.map((p, i) => (
              <li key={p.key} className="flex gap-4 break-inside-avoid">
                <span className="w-5 shrink-0 text-sm font-semibold tabular-nums text-navy">{i + 1}.</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {p.title} <span className="font-normal text-muted-foreground">· {p.area}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{p.rationale}</p>
                  <p className="mt-1 text-sm print:hidden">
                    <ReportLink href={p.href} event="market_reality_action_clicked" properties={{ key: p.key, area: p.area, rank: i + 1, href: p.href }}>
                      {p.cta}
                    </ReportLink>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </ReportSection>
  )
}

export function BasisSection({ brief }: { brief: MarketRealityBrief }) {
  const { rows, unconfirmed } = brief.basis
  const missing = rows.filter((r) => !r.value).length
  return (
    <ReportSection
      id="basis"
      number="01"
      title="Basis of assessment"
      finding={
        !brief.basis.goalsComplete
          ? 'Your Search Strategy goals are not all set, so the market below is sized partly on inference from the resume. Set them first: the market, the volumes and the pivot options all follow from them.'
          : 
        missing > 0 || unconfirmed.length > 0
          ? `Everything below is read against this profile. ${missing > 0 ? `${missing} detail${missing === 1 ? ' is' : 's are'} not set. ` : ''}${unconfirmed.length > 0 ? `${unconfirmed.length} ${unconfirmed.length === 1 ? 'item is' : 'items are'} inferred from the resume and unconfirmed.` : ''} Correct these first: every estimate that follows moves with them.`
          : 'Everything below is read against this profile. Each detail is confirmed.'
      }
    >
      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4 border-b border-border pb-2 text-sm">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="text-right font-medium text-foreground">
              {r.value ?? (
                <span className="print:hidden">
                  <ReportLink href={r.href} event="market_reality_basis_edit_clicked" properties={{ field: r.label }}>
                    Not set. Add
                  </ReportLink>
                </span>
              )}
              {!r.value && <span className="hidden font-normal text-muted-foreground print:inline">Not set</span>}
            </dd>
          </div>
        ))}
      </dl>
      {unconfirmed.length > 0 && (
        <p className="text-sm text-muted-foreground print:hidden">
          Unconfirmed:{' '}
          {unconfirmed.map((u, i) => (
            <span key={u.label}>
              {i > 0 && ', '}
              <ReportLink href={u.href} event="market_reality_basis_edit_clicked" properties={{ field: u.label, unconfirmed: true }}>
                {u.label}
              </ReportLink>
            </span>
          ))}
          .
        </p>
      )}
    </ReportSection>
  )
}
