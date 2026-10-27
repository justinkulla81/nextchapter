import Link from 'next/link'
import { SourceRefs } from '@/components/layoffs/WarnSources'
import { FEDERAL_WARN, stateWarnLaw } from '@/lib/warn-guide/rules'
import { stateName, stateSlug } from '@/lib/seo/states'
import { companyWarnFacts } from '@/lib/warn/company-facts'
import { noticeDay, type CompanySummary } from '@/lib/warn/layoff-pages'

const LINK = 'text-brand underline underline-offset-4'

/** "What this means if you work at X" on an employer's layoff page: its own numbers, the rule that applies, and where to go next. */
export function CompanyWarnBlock({ c }: { c: CompanySummary }) {
  const f = companyWarnFacts(c)
  const hasNotices = f.total > 0
  const stateLaws = c.states.map((s) => stateWarnLaw(s)).filter((x): x is NonNullable<typeof x> => !!x)

  return (
    <section aria-labelledby="means" className="mt-12 rounded-xl border border-border bg-white p-6">
      <h2 id="means" className="text-2xl font-bold tracking-tight text-navy">What this means if you work at {c.name}</h2>

      {hasNotices && (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-off-white p-3">
            <dt className="text-xs text-muted-foreground">Notices on file</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-navy">{f.total.toLocaleString('en-US')}</dd>
            {f.first && <dd className="text-xs text-muted-foreground">since {noticeDay(f.first)}</dd>}
          </div>
          <div className="rounded-lg bg-off-white p-3">
            <dt className="text-xs text-muted-foreground">Last 12 months</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-navy">{f.recent.toLocaleString('en-US')} {f.recent === 1 ? 'notice' : 'notices'}</dd>
            <dd className="text-xs text-muted-foreground">
              {f.recentWorkers > 0 ? `naming ${f.recentWorkers.toLocaleString('en-US')} workers${f.recentUnknown ? ` (${f.recentUnknown} gave no count)` : ''}` : f.recent > 0 ? 'no worker counts given' : 'none filed'}
            </dd>
          </div>
          <div className="rounded-lg bg-off-white p-3">
            <dt className="text-xs text-muted-foreground">Months with a filing</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-navy">{f.monthsWithFilings.toLocaleString('en-US')}</dd>
            <dd className="text-xs text-muted-foreground">{f.recentMonthsWithFilings} in the last 12 months</dd>
          </div>
          <div className="rounded-lg bg-off-white p-3">
            <dt className="text-xs text-muted-foreground">States</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-navy">{f.states.length}</dd>
            <dd className="text-xs text-muted-foreground">{f.states.map(stateName).join(', ')}</dd>
          </div>
        </dl>
      )}

      <div className="mt-5 max-w-3xl space-y-3 text-sm text-muted-foreground">
        {hasNotices ? (
          <p>
            {c.name} filed {f.total.toLocaleString('en-US')} notice{f.total === 1 ? '' : 's'}. A WARN notice is an employer’s written warning that it plans a plant closing or mass layoff, filed with the state and the local government. It names the site and the number of
            workers, and it does not say why. A notice on file does not mean your own job is affected: the number is for the site named.
          </p>
        ) : (
          <p>
            {c.name} has no WARN notice on our record. That does not mean no one was laid off: a layoff below the thresholds needs no notice, and some states publish late or not at all.
          </p>
        )}
        <p>
          If a layoff is covered, the employer must give you written notice at least 60 days ahead.<SourceRefs keys={FEDERAL_WARN.notice.sources} /> The federal Act applies to employers with 100 or more employees, not counting part-time employees.<SourceRefs keys={FEDERAL_WARN.coverage.sources} />{' '}
          An employer that skips required notice owes affected employees back pay and benefits for up to 60 days.<SourceRefs keys={FEDERAL_WARN.remedy.sources} />
        </p>
        {stateLaws.length > 0 && (
          <p>
            {stateLaws.map((s) => s.name).join(' and ')} {stateLaws.length === 1 ? 'has' : 'have'} {stateLaws.length === 1 ? 'its' : 'their'} own WARN {stateLaws.length === 1 ? 'law' : 'laws'}, with different thresholds or notice. See{' '}
            {stateLaws.map((s, i) => (
              <span key={s.code}>
                {i > 0 && ' and '}
                <Link href={`/resources/warn-act#states`} className={LINK}>{s.name}</Link>
              </span>
            ))}{' '}
            in the guide.
          </p>
        )}
      </div>

      <h3 className="mt-6 text-base font-semibold text-navy">Your next steps</h3>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
        <li><Link href="/resources/warn-act" className={LINK}>The WARN Act in plain language</Link>: who is covered, when notice is due, what is owed</li>
        <li><Link href="/tools/layoff-deadlines" className={LINK}>Layoff deadlines</Link>: what to file and by when</li>
        <li><Link href="/tools/severance-calculator" className={LINK}>Severance calculator</Link></li>
        {c.states.slice(0, 2).map((s) => (
          <li key={s}><Link href={`/unemployment-benefits/${stateSlug(s)}`} className={LINK}>{stateName(s)} unemployment benefits</Link>: amounts and how to file</li>
        ))}
        <li><Link href="/resources/cobra-aca" className={LINK}>COBRA vs ACA</Link>: keeping health coverage after a layoff</li>
        <li><Link href="/tools/layoff-risk-check" className={LINK}>Layoff risk check</Link> if you still work at {c.name} and want to know your signals</li>
      </ul>
    </section>
  )
}
