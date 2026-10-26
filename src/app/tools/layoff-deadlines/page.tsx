import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK, ActionBand } from '@/components/seo/SeoPage'
import { LayoffDeadlines } from '@/components/tools/LayoffDeadlines'
import { getPersona } from '@/lib/constants/personas'
import { journeyChoices } from '@/lib/leads/infer-journey'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'

export const metadata: Metadata = pageMetadata('/tools/layoff-deadlines')

const FAQ = [
  { q: 'What deadlines matter after a layoff?', a: 'File for unemployment benefits right away, since in most states you cannot be paid for weeks before you file. Then watch the health coverage windows: you usually have 60 days to choose COBRA and 60 days after coverage ends to join a Marketplace plan.' },
  { q: 'When does the 60-day COBRA window start?', a: 'It runs from the later of the date your coverage ends or the date you receive your COBRA election notice. This tool counts from your last day, which is the cautious way to plan.' },
  { q: 'Are these dates exact?', a: 'No. They are a guide counted from your last day. Confirm the exact dates on your own paperwork, with your plan administrator and with your state.' },
  { q: 'Do I need an account?', a: 'No. The dates are worked out on this page and nothing is saved unless you ask for reminder emails.' },
]

export default function LayoffDeadlinesPage() {
  const choices = journeyChoices('laid-off')
    .map((s) => getPersona(s))
    .filter((p): p is NonNullable<ReturnType<typeof getPersona>> => !!p)
    .map((p) => ({ slug: p.slug, label: p.label }))
  return (
    <SeoPage
      trail={[{ name: 'Tools', path: '/tools' }, { name: 'Layoff deadlines', path: '/tools/layoff-deadlines' }]}
      h1={pageH1('/tools/layoff-deadlines', 'Layoff deadlines: what to do and by when')}
      lede="Enter your last day of work to see the dates that matter in the weeks after a layoff: filing for unemployment and choosing health coverage. Free, no account."
      jsonLd={[
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Layoff deadlines', applicationCategory: 'LifestyleApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
      ]}
    >
      <LayoffDeadlines journeyChoices={choices} />
      <section aria-labelledby="faq" className="mt-12">
        <h2 id="faq" className={H2}>Layoff deadline questions</h2>
        <dl className="mt-4 max-w-3xl space-y-4 text-sm">
          {FAQ.map((f) => (
            <div key={f.q}><dt className="font-medium text-navy">{f.q}</dt><dd className="mt-1 text-muted-foreground">{f.a}</dd></div>
          ))}
        </dl>
        <p className="mt-6 text-sm text-muted-foreground">
          More: <Link href="/unemployment-benefits" className={LINK}>unemployment benefits by state</Link>, <Link href="/resources/cobra-aca" className={LINK}>COBRA and marketplace health coverage</Link>, <Link href="/resources/72-hours" className={LINK}>the first 72 hours after a layoff</Link> and <Link href="/tools/severance-calculator" className={LINK}>the severance calculator</Link>.
        </p>
      </section>
      <ActionBand title="Plan the weeks after a layoff" body="A free Market Reality Assessment and a weekly plan that starts with the deadlines." label="Get my free assessment" href={MARKET_REALITY_START_HREF} event="tool_page_cta_clicked" properties={{ tool: 'layoff_deadlines' }} />
    </SeoPage>
  )
}
