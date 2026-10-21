import { SIGNAL_LABELS } from '@/lib/likely-openings/roles'
import { LikelyOpeningFilingLink } from '@/components/likely-openings/FilingLink'
import type { CompanyIntelPanels as CompanyIntelPanelsData } from '@/lib/companies/company-intel-data'
import { EmptyNote, PlainNote, SectionBlock, SourceLine } from '@/components/candidate/Blocks'
import type { RecoveryStatus } from '@/lib/companies/layoff-timeline'

const usd = (n: number) => `$${Math.round(n / 1000).toLocaleString()}k`
const dateLabel = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })

const RECOVERY_COPY: Record<RecoveryStatus, string | null> = {
  none: null,
  recent_cut: 'A recent cut with little hiring since — worth asking about stability.',
  hiring_again: 'Hiring again since the cut.',
  quiet: 'No notable hiring since the cut.',
  before_tracking: "This predates our posting history, so we can't say what they've hired since.",
}

// What a company pays, its layoff history, and how to approach applying: plain sections, each an honest "nothing yet" when there is nothing to say.
export function CompanyIntelPanelsView({ d }: { d: CompanyIntelPanelsData }) {
  const recovery = RECOVERY_COPY[d.layoffs.status]
  return (
    <>
      <SectionBlock id="pay-h" title="What they pay" why="Salary ranges posted on this company's open roles.">
        {d.pay.length === 0 ? (
          <EmptyNote>None of this company&apos;s open roles post a salary range yet, so we cannot show one.</EmptyNote>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {d.pay.map((g) => (
                <li key={`${g.level}|${g.function ?? ''}`} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
                  <span className="text-base text-ink">
                    {g.level === 'IC' ? 'Individual contributor' : g.level}
                    {g.function ? `, ${g.function}` : ''}
                  </span>
                  <span className="text-base text-ink">
                    <span className="font-semibold">
                      {usd(g.medianMin)} to {usd(g.medianMax)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {' '}
                      from {g.postings} {g.postings === 1 ? 'posting' : 'postings'}
                      {g.postings > 1 && ` (${usd(g.lowest)} to ${usd(g.highest)} overall)`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <SourceLine>Posted ranges on live roles, annual USD. Medians are shown where there is more than one posting.</SourceLine>
          </>
        )}
        {d.visaWages.length > 0 && (
          <div className="space-y-2 pt-2">
            <h3 className="font-display text-lg font-semibold text-ink">On visa filings</h3>
            <ul className="divide-y divide-border">
              {d.visaWages.map((w) => (
                <li key={w.socTitle} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
                  <span className="text-base text-ink">{w.socTitle}</span>
                  <span className="text-base text-ink">
                    <span className="font-semibold">
                      {usd(w.p25)} to {usd(w.p75)}, median {usd(w.median)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {' '}
                      from {w.filings} filings{w.state ? `, mostly ${w.state}` : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <SourceLine>
              Base annual wage this employer told the U.S. Department of Labor it would pay on certified H-1B filings in the last two years. It shows what they offer for these occupations, not what
              a specific role here pays, and it leaves out bonus and equity.
            </SourceLine>
          </div>
        )}
      </SectionBlock>

      <SectionBlock id="layoffs-h" title="Layoffs and recovery" why="From public WARN filings in the last two years.">
        {d.layoffs.events.length === 0 ? (
          <EmptyNote>No layoff filings on record for this company in the last two years.</EmptyNote>
        ) : (
          <>
            {recovery && <PlainNote className="font-semibold">{recovery}</PlainNote>}
            <ul className="divide-y divide-border">
              {d.layoffs.events.slice(0, 6).map((e) => (
                <li key={e.noticeDate.toISOString()} className="py-3 text-base text-ink">
                  <span className="font-semibold">{dateLabel(e.noticeDate)}</span>
                  {e.employees ? `, ${e.employees.toLocaleString()} employees` : ''}
                  {e.postedSince !== null && (
                    <span className="text-muted-foreground">
                      {'. '}
                      {e.postedSince} {e.postedSince === 1 ? 'role' : 'roles'} posted since
                      {e.topFunctionsSince.length > 0 && ` (${e.topFunctionsSince.join(', ')})`}
                    </span>
                  )}
                  {e.sourceUrl && (
                    <>
                      {'. '}
                      <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-brand underline underline-offset-4">
                        See the filing
                      </a>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <SourceLine>Our posting history begins mid-2026, so earlier cuts cannot show what followed.</SourceLine>
          </>
        )}
      </SectionBlock>

      {(d.filings.length > 0 || d.federal) && (
        <SectionBlock id="filings-h" title="Recent filings" why="A leadership change, a large raise or new federal work often comes before hiring. It is a hint to look, not an open role.">
          {d.federal && (
            <PlainNote>
              <span className="font-semibold">Federal contracts.</span> {d.federal.awards} {d.federal.awards === 1 ? 'award' : 'awards'} started in the last two years, about{' '}
              {d.federal.totalAmount >= 1e9 ? `$${(d.federal.totalAmount / 1e9).toFixed(1)}B` : `$${Math.round(d.federal.totalAmount / 1e6).toLocaleString()}M`} in total value
              {d.federal.topAgency ? `, mostly ${d.federal.topAgency}` : ''}. Source: USAspending.gov.
            </PlainNote>
          )}
          <ul className="divide-y divide-border">
            {d.filings.map((f) => (
              <li key={f.id} className="py-3 text-base text-ink">
                <span className="font-semibold">{SIGNAL_LABELS[f.signalType]}</span>, {dateLabel(f.filingDate)}. <span className="text-muted-foreground">{f.summary}</span>{' '}
                <LikelyOpeningFilingLink
                  likelyOpeningId={f.id}
                  companyName={d.companyName}
                  signalType={f.signalType}
                  href={f.filingUrl}
                  source="company_page"
                  label={f.source === 'news' ? 'Read the report' : 'Read the filing'}
                />
              </li>
            ))}
          </ul>
        </SectionBlock>
      )}

      <SectionBlock id="apply-h" title="How to apply" why="What we can tell from how this company's open roles are posted.">
        {d.openPostings === 0 ? (
          <EmptyNote>No open roles right now.</EmptyNote>
        ) : (
          <>
            {d.apply.ats ? (
              <div className="space-y-2">
                <PlainNote>
                  <span className="font-semibold">Applications go through {d.apply.ats.info.name}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    ({d.apply.ats.postings} of {d.apply.ats.of} open roles)
                  </span>
                </PlainNote>
                <ul className="list-disc space-y-1 pl-6 text-base text-ink">
                  {d.apply.ats.info.tips.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <EmptyNote>We could not tell which application system its roles use.</EmptyNote>
            )}
            <ul className="space-y-1.5 text-base text-ink">
              {d.apply.medianDaysOpen !== null && (
                <li>
                  Roles have been open a median of {d.apply.medianDaysOpen} days since we first saw them
                  {d.apply.medianDaysOpen >= 60 && ', which can mean a slow process or a hard role to fill'}.
                </li>
              )}
              {d.apply.backing && (
                <li>
                  {d.apply.backing}
                  {d.apply.backing === 'PE-backed' ? ', so expect a cost focus and a leaner, faster process.' : ', so growth and runway matter. Ask about the next round.'}
                </li>
              )}
              {d.apply.recruiterLedSearches > 0 && (
                <li>
                  {d.apply.recruiterLedSearches} of its roles {d.apply.recruiterLedSearches === 1 ? 'is a' : 'are'} recruiter-led searches, and going through the search firm usually beats applying cold.
                </li>
              )}
            </ul>
          </>
        )}
      </SectionBlock>
    </>
  )
}
