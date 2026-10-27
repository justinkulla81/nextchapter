import { pageMetadata } from '@/lib/seo/keywords'
import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { StructuredData } from '@/components/StructuredData'
import { AuthorByline, formatContentDate } from '@/components/seo/AuthorByline'
import { StateBenefitsTable, type BenefitsRow } from '@/components/benefits/StateBenefitsTable'
import { STATE_UI, UI_LAST_VERIFIED } from '@/lib/data/state-ui'
import { latestReport, reportPath } from '@/lib/reports'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'
import { DeadlineEmailBox } from '@/components/cobra-aca/DeadlineEmailBox'
import { LaidOffStart } from '@/components/cobra-aca/LaidOffStart'
import { getPersona } from '@/lib/constants/personas'
import { journeyChoices } from '@/lib/leads/infer-journey'
import { TREATMENT_LABEL, TREATMENT_SENTENCE, TREATMENT_VERB } from '@/lib/severance/calc'
import { groupByTreatment } from '@/lib/severance/state-groups'

const DESCRIPTION =
  'Unemployment benefits in every state and DC: the maximum and minimum weekly benefit, how many weeks, the waiting week, how severance counts, and where to file. From official Department of Labor and state sources.'

export const metadata: Metadata = pageMetadata('/unemployment-benefits')

const LINK = 'text-brand underline underline-offset-4'

export default function UnemploymentBenefitsHub() {
  const rows: BenefitsRow[] = ALL_STATE_CODES.map((code) => {
    const ui = STATE_UI[code]
    return {
      code,
      name: stateName(code),
      slug: stateSlug(code),
      maxWeekly: ui.maxWeeklyBenefit.value,
      minWeekly: ui.minWeeklyBenefit.value,
      maxWeeks: ui.maxWeeks.value,
      durationVaries: ui.durationVaries.value,
      waitingWeek: ui.waitingWeek.value,
    }
  })
  const report = latestReport()
  const groups = groupByTreatment()
  const choices = journeyChoices('laid-off')
    .map((s) => getPersona(s))
    .filter((p): p is NonNullable<ReturnType<typeof getPersona>> => !!p)
    .map((p) => ({ slug: p.slug, label: p.label }))

  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Unemployment benefits by state', description: DESCRIPTION }} />
      <PublicSiteHeader />
      <main className="mx-auto w-full max-w-5xl px-6 py-14">
        <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">Unemployment benefits by state</h1>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-foreground">
          How much unemployment pays, for how long, and how to file, in every state and DC. Choose a state for how severance
          and pay in lieu of notice count, the work-search rules, and local job centers.
        </p>
        <AuthorByline updated={UI_LAST_VERIFIED} />
        <p className="mt-1 text-sm text-muted-foreground">Last verified {formatContentDate(UI_LAST_VERIFIED)} against official sources.</p>

        <div className="mt-8">
          <StateBenefitsTable rows={rows} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Weekly amounts exclude dependents’ allowances. Sources: U.S. Department of Labor, Significant Provisions of State
          Unemployment Insurance Laws, and each state agency. “Check with state” means official sources disagreed or the figure
          could not be confirmed; we don’t estimate.
        </p>

        <section aria-labelledby="severance-h" id="severance" className="mt-14">
          <h2 id="severance-h" className="text-2xl font-bold tracking-tight text-navy">Does severance affect unemployment? By state</h2>
          <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground">
            It depends on the state. From the Department of Labor’s comparison of state laws and each state agency: {groups
              .filter((g) => g.treatment)
              .map((g) => `${g.states.length} ${g.states.length === 1 ? 'state' : 'states'} ${TREATMENT_VERB[g.treatment!]}`)
              .join(', ')}
            {groups.some((g) => !g.treatment) ? `, and ${groups.find((g) => !g.treatment)!.states.length} where official sources disagree` : ''}. Pick your state for its own rule, with the source.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {groups.map((g) => (
              <div key={g.treatment ?? 'unconfirmed'} className="rounded-xl border border-border bg-white p-4">
                <h3 className="text-base font-semibold text-navy">
                  {g.treatment ? TREATMENT_LABEL[g.treatment] : 'Not confirmed: check with the state'} <span className="font-normal text-muted-foreground">({g.states.length})</span>
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {g.treatment ? TREATMENT_SENTENCE[g.treatment] : 'Official sources disagreed on the rule, so we do not estimate it. The state page links the agency.'}
                </p>
                <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                  {g.states.map((r) => (
                    <li key={r.code}>
                      <Link href={`/unemployment-benefits/${r.slug}`} className={LINK}>{r.name}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            More: <Link href="/resources/severance-pay" className={LINK}>severance pay: taxes, negotiating and the agreement</Link> and the{' '}
            <Link href="/tools/severance-calculator" className={LINK}>severance calculator</Link>.
          </p>
        </section>

        <section aria-labelledby="remind" className="mt-14">
          <h2 id="remind" className="text-2xl font-bold tracking-tight text-navy">Get the dates in your inbox</h2>
          <div className="mt-4 max-w-xl">
            <DeadlineEmailBox
              source="unemployment:hub"
              journeyChoices={choices}
              eventPrefix="unemployment"
              blurb="One email as each date comes up over the next two months: filing, the severance agreement review, health coverage. Then nothing. No account needed."
            />
          </div>
          <div className="mt-4">
            <LaidOffStart placement="unemployment_hub" eventPrefix="unemployment" />
          </div>
        </section>

        {report && (
          <p className="mt-10 max-w-3xl text-sm text-muted-foreground">
            How many people run out of benefits before finding work: see unemployment-insurance exhaustion in the{' '}
            <Link href={`${reportPath(report)}#safetynet`} className={LINK}>{report.month} White Collar Employment Report</Link>.
          </p>
        )}
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
          Recently laid off? Start with <Link href="/start/laid-off" className={LINK}>what to do after a layoff</Link> and check the{' '}
          <Link href="/layoffs" className={LINK}>layoff tracker</Link> for WARN notices in your state.
        </p>
      </main>
      <PublicSiteFooter page="benefits" />
    </div>
  )
}
