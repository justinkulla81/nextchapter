import type { Metadata } from 'next'
import Link from 'next/link'
import { StructuredData } from '@/components/StructuredData'
import { Button } from '@/components/ui/button'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { SITE_URL } from '@/lib/reports'

const URL = `${SITE_URL}/reports/replication`
const REPO_URL = 'https://github.com/justinkulla81/nextchapter-displacement-report'
const REPORT_PATH = '/reports/displacement-report-september-2026'
const CORRECTIONS_EMAIL = 'jkulla@launchyournextchapter.com'
const DESCRIPTION =
  'Code, parameters and derived data to reproduce the NextChapter Displacement Report: the White-Collar Long-Term Unemployment Index, CPS breakdowns, margins of error, SEC AI coding and more.'

export const metadata: Metadata = {
  title: { absolute: 'Displacement Report: replication materials | NextChapter' },
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: {
    type: 'website',
    title: 'Displacement Report: replication materials',
    description: DESCRIPTION,
    url: URL,
    siteName: 'NextChapter',
    images: [{ url: `${SITE_URL}/reports/displacement-report-2026-09-og.png?v=1.72`, width: 1200, height: 630 }],
  },
}

// Mirrors the "What you can reproduce" table in the repository README.
const REPRODUCIBLE: { output: string; how: string }[] = [
  { output: 'White-Collar Long-Term Unemployment Index (Exhibit 1), monthly 2015–2026', how: 'code/01_wc_index_monthly.py → data/wc-index.csv' },
  { output: 'Breakdowns by occupation, industry and age; older workers; graduates; blue-collar', how: 'code/02_cps_breakdowns.py, code/03_cps_aggregates.py' },
  { output: '90% margins of error (BLS generalized variance method)', how: 'code/04_margins_of_error.py with data/bls_gvf_parameters.json' },
  { output: 'Seasonal-adjustment robustness (fixed factors, X-13ARIMA-SEATS, STL, 12-month average)', how: 'code/05_seasonal_sensitivity.py, code/x13_wcltu.spc' },
  { output: 'AI in SEC restructuring filings (Form 8-K, Item 2.05)', how: 'methodology/sec_item205_search.md, data/sec-item205-ai-coding-2026.csv' },
  { output: 'Hires per job opening, 2001–2026', how: 'data/hires_per_opening.csv (BLS JOLTS via FRED)' },
  { output: 'Revenue per employee, 27 large white-collar employers', how: 'data/displacement-report-2026-q3-revenue-per-employee.csv' },
  { output: 'Industry productivity vs long searches (Q3 feature)', how: 'code/08_industry_productivity.py, data/industry_productivity_vs_long_searches.csv' },
  { output: 'Nativity breakdown and age-sex standardized 55+ participation', how: 'code/09_nativity_and_age_standardization.py' },
  { output: 'Beyond-unemployment white-collar panel', how: 'code/10_hidden_displacement.py, data/cps_hidden_displacement_wc_jan_aug_2019_2025_2026.json' },
  { output: 'AI exposure vs outcomes by occupation (including the customer service test)', how: 'code/11_exposure_vs_outcomes.py, data/exposure_test_results.json' },
  { output: 'Education and experience breakdowns', how: 'code/12_education_experience.py, data/cps_education_experience_2019_2022_2025_2026.json' },
  { output: 'Total factor productivity decomposition (Q3 addendum)', how: 'code/13_tfp_decomposition.md, data/sf_fed_tfp_decomposition.csv (SF Fed quarterly TFP series)' },
  { output: 'Senior openings tracker (pilot, Appendix A)', how: 'code/07_openings_tracker_pilot.py (needs the NextChapter jobs database; not reproducible externally)' },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareSourceCode',
      name: 'NextChapter Displacement Report replication materials',
      description: DESCRIPTION,
      codeRepository: REPO_URL,
      programmingLanguage: 'Python',
      license: 'https://opensource.org/licenses/MIT',
      url: URL,
      author: { '@type': 'Organization', name: 'NextChapter', url: SITE_URL },
      isPartOf: { '@type': 'Report', name: 'NextChapter Displacement Report: September 2026', url: `${SITE_URL}${REPORT_PATH}` },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Reports', item: `${SITE_URL}/reports` },
        { '@type': 'ListItem', position: 3, name: 'Replication materials', item: URL },
      ],
    },
  ],
}

export default function ReplicationPage() {
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={jsonLd} />
      <PublicSiteHeader current="reports" />

      <main className="mx-auto w-full max-w-4xl px-6 py-14">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <Link href="/reports" className="hover:text-foreground">Displacement Report</Link>
          <span aria-hidden> › </span>
          <span className="text-foreground">Replication materials</span>
        </nav>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
          Displacement Report: replication materials
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-relaxed text-foreground">
          The code, parameters and derived data behind the NextChapter Displacement Report are public, so anyone can
          check our numbers. The scripts download Census Current Population Survey microdata directly and rebuild the
          index, breakdowns and margins of error published in the{' '}
          <Link href={REPORT_PATH} className="text-brand underline underline-offset-4">September 2026 edition</Link>.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button nativeButton={false} render={<a href={REPO_URL} />}>
            View the code on GitHub
          </Button>
          <Button nativeButton={false} variant="outline" render={<Link href={`${REPORT_PATH}#method`} />}>
            Read the methodology
          </Button>
        </div>

        <section className="mt-12">
          <h2 className="text-xl font-bold tracking-tight text-navy">What you can reproduce</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-light-gray text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Output in the report</th>
                  <th className="py-2 font-medium">Where in the repository</th>
                </tr>
              </thead>
              <tbody>
                {REPRODUCIBLE.map((r) => (
                  <tr key={r.output} className="border-b border-light-gray align-top">
                    <td className="py-2.5 pr-4 text-foreground">{r.output}</td>
                    <td className="py-2.5 font-mono text-xs leading-relaxed text-muted-foreground">{r.how}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Code: MIT License. Data files and documentation: CC BY 4.0. Census microdata are not redistributed; the
            scripts fetch them with a free Census API key.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-bold tracking-tight text-navy">How we record changes between editions</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Every change between versions and editions (a new section, a revised figure, a correction or a new data
            source) is logged with what it was before, what it is now, why it changed and whether earlier numbers are
            affected. The rules are in{' '}
            <a href={`${REPO_URL}/blob/main/methodology/change_record_standard.md`} className="text-brand underline underline-offset-4">
              methodology/change_record_standard.md
            </a>
            , and the record itself is the repository&apos;s{' '}
            <a href={`${REPO_URL}/blob/main/CHANGELOG.md`} className="text-brand underline underline-offset-4">CHANGELOG</a>.
          </p>
        </section>

        <section className="mt-12 rounded-xl border border-light-gray bg-white p-6">
          <h2 className="text-lg font-bold tracking-tight text-navy">Found an error?</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Send corrections to Justin Kulla at{' '}
            <a href={`mailto:${CORRECTIONS_EMAIL}`} className="text-brand underline underline-offset-4">
              {CORRECTIONS_EMAIL}
            </a>
            . Corrections are dated and noted in the report&apos;s version log and the repository&apos;s changelog.
          </p>
        </section>
      </main>

      <PublicSiteFooter page="reports" />
    </div>
  )
}
