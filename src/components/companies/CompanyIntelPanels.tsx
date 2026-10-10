import { Banknote, TrendingUp, ClipboardList } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { loadCompanyIntelPanels } from '@/lib/companies/company-intel-data'
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

// What a company pays, its layoff history, and how to approach applying — three plain
// cards, each an honest "nothing yet" when there is nothing to say.
export async function CompanyIntelPanels({ companyId, isCandidatePlus }: { companyId: string; isCandidatePlus: boolean }) {
  const d = await loadCompanyIntelPanels(companyId, isCandidatePlus)

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="size-4" aria-hidden="true" />
            What they pay
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {d.pay.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              None of this company&apos;s open roles post a salary range yet, so we can&apos;t show one.
            </p>
          ) : (
            <>
              <ul className="space-y-1.5">
                {d.pay.map((g) => (
                  <li key={`${g.level}|${g.function ?? ''}`} className="text-sm">
                    <span className="font-medium text-foreground">
                      {g.level === 'IC' ? 'Individual contributor' : g.level}
                      {g.function ? `, ${g.function}` : ''}
                    </span>
                    : {usd(g.medianMin)}–{usd(g.medianMax)}
                    <span className="text-muted-foreground">
                      {' '}
                      · {g.postings} {g.postings === 1 ? 'posting' : 'postings'}
                      {g.postings > 1 && ` (${usd(g.lowest)}–${usd(g.highest)} overall)`}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Posted ranges on live roles, annual USD. Medians are shown where there is more than one posting.
              </p>
            </>
          )}
          {d.visaWages.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-border pt-3">
              <p className="text-sm font-medium text-foreground">On visa filings</p>
              <ul className="space-y-1">
                {d.visaWages.map((w) => (
                  <li key={w.socTitle} className="text-sm">
                    <span className="text-foreground">{w.socTitle}</span>: {usd(w.p25)}–{usd(w.p75)}, median {usd(w.median)}
                    <span className="text-muted-foreground">
                      {' '}
                      · {w.filings} filings{w.state ? `, mostly ${w.state}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Base annual wage this employer told the U.S. Department of Labor it would pay on certified
                H-1B filings in the last two years. It shows what they offer for these occupations, not what a
                specific role here pays, and it leaves out bonus and equity.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-4" aria-hidden="true" />
            Layoffs and recovery
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {d.layoffs.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No layoff filings on record for this company in the last two years.</p>
          ) : (
            <>
              {RECOVERY_COPY[d.layoffs.status] && (
                <p className="text-sm font-medium text-foreground">{RECOVERY_COPY[d.layoffs.status]}</p>
              )}
              <ul className="space-y-1.5">
                {d.layoffs.events.slice(0, 6).map((e) => (
                  <li key={e.noticeDate.toISOString()} className="text-sm text-muted-foreground">
                    <span className="text-foreground">{dateLabel(e.noticeDate)}</span>
                    {e.employees ? ` · ${e.employees.toLocaleString()} employees` : ''}
                    {e.postedSince !== null && (
                      <>
                        {' · '}
                        {e.postedSince} {e.postedSince === 1 ? 'role' : 'roles'} posted since
                        {e.topFunctionsSince.length > 0 && ` (${e.topFunctionsSince.join(', ')})`}
                      </>
                    )}
                    {e.sourceUrl && (
                      <>
                        {' · '}
                        <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                          filing
                        </a>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                From public WARN filings. Our posting history begins mid-2026, so earlier cuts can&apos;t show what followed.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="size-4" aria-hidden="true" />
            How to apply
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {d.openPostings === 0 ? (
            <p className="text-sm text-muted-foreground">No open roles right now.</p>
          ) : (
            <>
              {d.apply.ats ? (
                <div className="space-y-1">
                  <p className="text-sm">
                    <span className="font-medium text-foreground">Applications go through {d.apply.ats.info.name}</span>
                    <span className="text-muted-foreground">
                      {' '}
                      ({d.apply.ats.postings} of {d.apply.ats.of} open roles)
                    </span>
                  </p>
                  <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                    {d.apply.ats.info.tips.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">We couldn&apos;t tell which application system its roles use.</p>
              )}
              <ul className="space-y-0.5 text-sm text-muted-foreground">
                {d.apply.medianDaysOpen !== null && (
                  <li>
                    Roles have been open a median of {d.apply.medianDaysOpen} days since we first saw them
                    {d.apply.medianDaysOpen >= 60 && ' — a slow process, or a hard role to fill'}.
                  </li>
                )}
                {d.apply.backing && (
                  <li>
                    {d.apply.backing}
                    {d.apply.backing === 'PE-backed'
                      ? ' — expect a cost focus and a leaner, faster process.'
                      : ' — growth and runway matter; ask about the next round.'}
                  </li>
                )}
                {d.apply.recruiterLedSearches > 0 && (
                  <li>
                    {d.apply.recruiterLedSearches} of its roles {d.apply.recruiterLedSearches === 1 ? 'is a' : 'are'} recruiter-led
                    searches — going through the search firm usually beats applying cold.
                  </li>
                )}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </>
  )
}
