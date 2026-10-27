import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK, ActionBand } from '@/components/seo/SeoPage'
import { SeveranceCalculator } from '@/components/tools/SeveranceCalculator'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'

export const metadata: Metadata = pageMetadata('/tools/severance-calculator')

const FAQ = [
  { q: 'How much severance should I get?', a: 'There is no required amount. A common formula is one to two weeks of pay per year of service, and senior roles often get more. Your contract, a company plan or the agreement you are offered sets the amount.' },
  { q: 'Is severance pay taxed?', a: 'Severance is generally taxed as wages, so withholding applies and the amount you receive is lower than the figure before taxes.' },
  { q: 'Does severance affect unemployment benefits?', a: 'In some states it does. Check your state’s page for how severance counts, and file right away either way.' },
  { q: 'Can I negotiate severance?', a: 'Yes. Offers are often negotiable, especially the amount, months of health coverage and the timing of a bonus or equity vest.' },
]

export default function SeveranceCalculatorPage() {
  return (
    <SeoPage
      trail={[{ name: 'Tools', path: '/tools' }, { name: 'Severance calculator', path: '/tools/severance-calculator' }]}
      h1={pageH1('/tools/severance-calculator', 'Severance calculator')}
      lede="Enter your pay and years of service to see what the common formula of one to two weeks of pay per year of service comes to, and what paid health coverage adds. Your agreement sets the real number."
      jsonLd={[
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Severance calculator', applicationCategory: 'FinanceApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
      ]}
    >
      <SeveranceCalculator />
      <section aria-labelledby="faq" className="mt-12">
        <h2 id="faq" className={H2}>Severance pay questions</h2>
        <dl className="mt-4 max-w-3xl space-y-4 text-sm">
          {FAQ.map((f) => (
            <div key={f.q}><dt className="font-medium text-navy">{f.q}</dt><dd className="mt-1 text-muted-foreground">{f.a}</dd></div>
          ))}
        </dl>
        <p className="mt-6 text-sm text-muted-foreground">
          More: <Link href="/topics/severance" className={LINK}>severance package: what it is and how to negotiate</Link>, <Link href="/unemployment-benefits" className={LINK}>unemployment benefits by state</Link>, <Link href="/resources/cobra-aca" className={LINK}>health insurance after a layoff</Link> and <Link href="/tools/cobra-vs-aca-calculator" className={LINK}>the COBRA vs ACA calculator</Link>.
        </p>
      </section>
      <ActionBand title="Plan the weeks after a layoff" body="A free Market Reality Assessment and a weekly plan that starts with the deadlines." label="Get my free assessment" href={MARKET_REALITY_START_HREF} event="tool_page_cta_clicked" properties={{ tool: 'severance_calculator' }} />
    </SeoPage>
  )
}
