import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK, ActionBand } from '@/components/seo/SeoPage'
import { LayoffRunway, type RunwayState } from '@/components/tools/LayoffRunway'
import { STATE_UI } from '@/lib/data/state-ui'
import { ALL_STATE_CODES, stateName } from '@/lib/seo/states'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'

export const metadata: Metadata = pageMetadata('/tools/layoff-runway')

const FAQ = [
  { q: 'How long should savings last after a layoff?', a: 'Many people plan for three to six months of spending, and a search for a senior role often takes longer. The calculator shows your own number from what you spend, not an average.' },
  { q: 'Do unemployment benefits count?', a: 'Yes, if you qualify. Choose your state to count benefits at its published maximum for the weeks it pays, then lower the weekly amount to your own. Benefits are usually lower than the maximum and are taxable income.' },
  { q: 'Should I include severance?', a: 'Include what you expect to receive after tax. Severance can delay or reduce unemployment benefits in some states, so check your state’s rules before counting both.' },
  { q: 'What about health insurance?', a: 'Add the monthly cost of COBRA or a Marketplace plan to what you spend each month. It is often one of the largest new costs after a layoff.' },
]

export default function Page() {
  const states: RunwayState[] = ALL_STATE_CODES.filter((c) => STATE_UI[c]).map((c) => ({ code: c, name: stateName(c), maxWeekly: STATE_UI[c].maxWeeklyBenefit.value, maxWeeks: STATE_UI[c].maxWeeks.value }))
  return (
    <SeoPage
      trail={[{ name: 'Tools', path: '/tools' }, { name: 'Layoff runway calculator', path: '/tools/layoff-runway' }]}
      h1={pageH1('/tools/layoff-runway', 'Layoff runway: how long your money will last')}
      lede="Enter your savings, monthly spending and any severance to see how many months they cover, and how much unemployment benefits for your state add. Free, nothing is saved."
      jsonLd={[
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Layoff runway calculator', applicationCategory: 'FinanceApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
      ]}
    >
      <LayoffRunway states={states} />
      <section aria-labelledby="faq" className="mt-12">
        <h2 id="faq" className={H2}>Layoff runway calculator questions</h2>
        <dl className="mt-4 max-w-3xl space-y-4 text-sm">
          {FAQ.map((f) => (
            <div key={f.q}><dt className="font-medium text-navy">{f.q}</dt><dd className="mt-1 text-muted-foreground">{f.a}</dd></div>
          ))}
        </dl>
        <p className="mt-6 text-sm text-muted-foreground">
          More: <Link href="/tools/unemployment-estimator" className={LINK}>unemployment benefit estimator</Link>, <Link href="/tools/severance-calculator" className={LINK}>severance calculator</Link>, <Link href="/resources/bridge-income" className={LINK}>bridge income while you search</Link> and <Link href="/resources/cobra-aca" className={LINK}>health coverage after a layoff</Link>.
        </p>
      </section>
      <ActionBand title="Plan the weeks after a layoff" body="A free Market Reality Assessment and a weekly plan that starts with the deadlines." label="Get my free assessment" href={MARKET_REALITY_START_HREF} event="tool_page_cta_clicked" properties={{ tool: 'layoff_runway' }} />
    </SeoPage>
  )
}
