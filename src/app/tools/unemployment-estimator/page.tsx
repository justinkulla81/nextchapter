import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK, ActionBand } from '@/components/seo/SeoPage'
import { UnemploymentEstimator, type EstimatorState } from '@/components/tools/UnemploymentEstimator'
import { STATE_UI } from '@/lib/data/state-ui'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'

export const metadata: Metadata = pageMetadata('/tools/unemployment-estimator')

const FAQ = [
  { q: 'How is unemployment benefit calculated?', a: 'Each state has its own formula, usually a share of your wages in a recent period, held between a minimum and a maximum weekly amount. A common rule of thumb is about half of your weekly pay. This tool uses that rule with your state’s published limits.' },
  { q: 'Is the estimate what I will be paid?', a: 'No. It is a planning figure. The state agency decides your amount after it reviews your wages, and it can be lower, so file as soon as you are laid off.' },
  { q: 'How long do benefits last?', a: 'The number of weeks is set by your state, and some states change it with the state unemployment rate. The tool shows the maximum weeks on file for your state.' },
  { q: 'Are unemployment benefits taxable?', a: 'Yes, they are generally taxable income, and you can ask for tax to be withheld when you file.' },
]

export default function Page() {
  const states: EstimatorState[] = ALL_STATE_CODES.filter((c) => STATE_UI[c]).map((c) => ({ code: c, slug: stateSlug(c), name: stateName(c), maxWeekly: STATE_UI[c].maxWeeklyBenefit.value, minWeekly: STATE_UI[c].minWeeklyBenefit.value, maxWeeks: STATE_UI[c].maxWeeks.value, agency: STATE_UI[c].agencyName.value, fileUrl: STATE_UI[c].fileUrl.value }))
  return (
    <SeoPage
      trail={[{ name: 'Tools', path: '/tools' }, { name: 'Unemployment benefit estimator', path: '/tools/unemployment-estimator' }]}
      h1={pageH1('/tools/unemployment-estimator', 'Unemployment benefit estimator: about how much you could get')}
      lede="Pick your state and enter your yearly pay for a planning estimate of the weekly benefit, how many weeks it can last and the most you could receive. The state sets the real amount."
      jsonLd={[
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Unemployment benefit estimator', applicationCategory: 'FinanceApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
      ]}
    >
      <UnemploymentEstimator states={states} />
      <section aria-labelledby="faq" className="mt-12">
        <h2 id="faq" className={H2}>Unemployment benefit estimator questions</h2>
        <dl className="mt-4 max-w-3xl space-y-4 text-sm">
          {FAQ.map((f) => (
            <div key={f.q}><dt className="font-medium text-navy">{f.q}</dt><dd className="mt-1 text-muted-foreground">{f.a}</dd></div>
          ))}
        </dl>
        <p className="mt-6 text-sm text-muted-foreground">
          More: <Link href="/unemployment-benefits" className={LINK}>unemployment benefits by state</Link>, <Link href="/tools/layoff-runway" className={LINK}>layoff runway calculator</Link> and <Link href="/tools/layoff-deadlines" className={LINK}>layoff deadlines</Link>.
        </p>
      </section>
      <ActionBand title="File first, then plan" body="A free Market Reality Assessment and a weekly plan that starts with the deadlines." label="Get my free assessment" href={MARKET_REALITY_START_HREF} event="tool_page_cta_clicked" properties={{ tool: 'unemployment_estimator' }} />
    </SeoPage>
  )
}
