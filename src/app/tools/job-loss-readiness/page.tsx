import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK, ActionBand } from '@/components/seo/SeoPage'
import { JobLossReadiness, type ReadinessState } from '@/components/tools/JobLossReadiness'
import { STATE_UI } from '@/lib/data/state-ui'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'

export const metadata: Metadata = pageMetadata('/tools/job-loss-readiness')

const FAQ = [
  { q: 'Is this a prediction that I will lose my job?', a: 'No. It is a what-if: if your job ended, how long your money would last, what unemployment might pay, and what would end with your work benefits. Most people never need it, and the ones who do are glad they looked early.' },
  { q: 'What usually ends when a job ends?', a: 'Job-based health coverage, group life insurance and group disability insurance generally end with the job or soon after. Health coverage has two 60-day choices, COBRA and a Marketplace plan. Life insurance often has a short conversion window, commonly 31 days, set by your plan.' },
  { q: 'How is the unemployment amount worked out?', a: 'As a planning estimate: half of your weekly pay, held between your state’s published minimum and maximum. Every state uses its own formula and the real amount can be lower. The runway counts it only after your savings are measured on their own.' },
  { q: 'Is my information saved?', a: 'No. The numbers are worked out in your browser and are not stored or sent.' },
]

export default function Page() {
  const states: ReadinessState[] = ALL_STATE_CODES.filter((c) => STATE_UI[c]).map((c) => ({
    code: c,
    slug: stateSlug(c),
    name: stateName(c),
    maxWeekly: STATE_UI[c].maxWeeklyBenefit.value,
    minWeekly: STATE_UI[c].minWeeklyBenefit.value,
    maxWeeks: STATE_UI[c].maxWeeks.value,
    agency: STATE_UI[c].agencyName.value,
    fileUrl: STATE_UI[c].fileUrl.value,
  }))
  return (
    <SeoPage
      trail={[{ name: 'Tools', path: '/tools' }, { name: 'Layoff readiness check', path: '/tools/job-loss-readiness' }]}
      h1={pageH1('/tools/job-loss-readiness', 'Layoff readiness check: if your job ended tomorrow')}
      lede="Still employed and a little nervous? In a minute, see how long your money would last, what unemployment would pay in your state, and what you would lose with your work benefits, with the dates that matter. Free, nothing saved."
      jsonLd={[
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Layoff readiness check', applicationCategory: 'FinanceApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
      ]}
    >
      <JobLossReadiness states={states} />
      <section aria-labelledby="faq" className="mt-12">
        <h2 id="faq" className={H2}>About this check</h2>
        <dl className="mt-4 max-w-3xl space-y-4 text-sm">
          {FAQ.map((f) => (
            <div key={f.q}><dt className="font-medium text-navy">{f.q}</dt><dd className="mt-1 text-muted-foreground">{f.a}</dd></div>
          ))}
        </dl>
        <p className="mt-6 text-sm text-muted-foreground">
          More: <Link href="/resources/pre-exit" className={LINK}>how to prepare for a layoff</Link>, <Link href="/tools/layoff-runway" className={LINK}>layoff runway calculator</Link>, <Link href="/resources/cobra-aca" className={LINK}>health coverage after a layoff</Link> and <Link href="/tools/layoff-risk-check" className={LINK}>layoff risk check</Link>.
        </p>
      </section>
      <ActionBand title="Get a plan for your next move" body="A free Market Reality Assessment and a weekly plan, whether you move now or just want options open." label="Get my free assessment" href={MARKET_REALITY_START_HREF} event="tool_page_cta_clicked" properties={{ tool: 'job_loss_readiness' }} />
    </SeoPage>
  )
}
