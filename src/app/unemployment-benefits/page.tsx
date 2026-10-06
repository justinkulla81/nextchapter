import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { StructuredData } from '@/components/StructuredData'
import { AuthorByline, formatContentDate } from '@/components/seo/AuthorByline'
import { StateBenefitsTable, type BenefitsRow } from '@/components/benefits/StateBenefitsTable'
import { STATE_UI, UI_LAST_VERIFIED } from '@/lib/data/state-ui'
import { latestReport, reportPath } from '@/lib/reports'
import { canonical } from '@/lib/seo/canonical'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'

const DESCRIPTION =
  'Unemployment benefits in every state and DC: the maximum and minimum weekly benefit, how many weeks, the waiting week, how severance counts, and where to file. From official Department of Labor and state sources.'

export const metadata: Metadata = {
  title: 'Unemployment benefits by state',
  description: DESCRIPTION,
  ...canonical('/unemployment-benefits'),
}

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

        {report && (
          <p className="mt-10 max-w-3xl text-sm text-muted-foreground">
            How many people run out of benefits before finding work: see unemployment-insurance exhaustion in the{' '}
            <Link href={`${reportPath(report)}#safetynet`} className={LINK}>{report.month} Displacement Report</Link>.
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
