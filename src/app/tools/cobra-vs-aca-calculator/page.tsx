import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
import { CobraAcaCalculator } from '@/components/cobra-aca/CobraAcaCalculator'
import { SourcesList } from '@/components/cobra-aca/SourcesList'
import { getPersona } from '@/lib/constants/personas'
import { journeyChoices } from '@/lib/leads/infer-journey'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'

export const metadata: Metadata = pageMetadata('/tools/cobra-vs-aca-calculator')

const FAQ = [
  { q: 'How does the calculator work?', a: 'You enter your state, household size, expected income for the year, the monthly COBRA premium on your notice and the date your coverage ends. It estimates the premium tax credit from the IRS table for the year you choose, shows what a Marketplace plan would cost after the credit next to your COBRA premium, and works out your deadlines.' },
  { q: 'Where do the numbers come from?', a: 'The credit uses the IRS applicable percentage tables for 2026 and 2027 and the federal poverty guidelines. Typical Marketplace prices are KFF’s state averages for the second-lowest-cost silver plan for a 40-year-old. Every source is listed at the bottom of the page.' },
  { q: 'How accurate is it?', a: 'It is an estimate. It moves the percentage in a straight line within each income band, while your tax return uses the exact figure from IRS Form 8962. It ignores cost-sharing reductions, state subsidies, your age, and differences between plans. Use a real quote from HealthCare.gov or your state marketplace for the final decision.' },
  { q: 'Is my information saved?', a: 'No. The comparison runs in your browser and nothing is stored. If you ask for deadline emails, only your email, your last day and your state are saved.' },
]

export default function CobraVsAcaCalculatorPage() {
  const choices = journeyChoices('laid-off')
    .map((s) => getPersona(s))
    .filter((p): p is NonNullable<ReturnType<typeof getPersona>> => !!p)
    .map((p) => ({ slug: p.slug, label: p.label }))
  return (
    <SeoPage
      trail={[{ name: 'Tools', path: '/tools' }, { name: 'COBRA vs ACA calculator', path: '/tools/cobra-vs-aca-calculator' }]}
      h1={pageH1('/tools/cobra-vs-aca-calculator', 'COBRA vs ACA cost calculator')}
      lede={`Enter your COBRA quote and your household income to see what a Marketplace plan would cost after the premium tax credit, side by side, with your COBRA and Marketplace deadlines. Free, no account, nothing saved.`}
      jsonLd={[
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'COBRA vs ACA cost calculator', applicationCategory: 'FinanceApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
      ]}
    >
      <CobraAcaCalculator journeyChoices={choices} />
      <section aria-labelledby="faq" className="mt-12">
        <h2 id="faq" className={H2}>About this calculator</h2>
        <dl className="mt-4 max-w-3xl space-y-4 text-sm">
          {FAQ.map((f) => (
            <div key={f.q}>
              <dt className="font-medium text-navy">{f.q}</dt>
              <dd className="mt-1 text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-sm text-muted-foreground">
          More: <Link href="/resources/cobra-aca" className={LINK}>COBRA vs ACA explained</Link>, <Link href="/tools/layoff-deadlines" className={LINK}>layoff deadlines</Link>, <Link href="/unemployment-benefits" className={LINK}>unemployment benefits by state</Link> and <Link href="/tools/severance-calculator" className={LINK}>the severance calculator</Link>.
        </p>
      </section>
      <SourcesList />
    </SeoPage>
  )
}
