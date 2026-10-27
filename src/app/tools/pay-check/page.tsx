import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK, ActionBand } from '@/components/seo/SeoPage'
import { PayCheck } from '@/components/tools/PayCheck'
import { getPersona } from '@/lib/constants/personas'
import { journeyChoices } from '@/lib/leads/infer-journey'
import { getTitleIndex, hasSalaryPage } from '@/lib/seo/job-titles'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'

// Not prerendered: the title scan reads the whole board, and a build runs it in up to seven workers at once, which timed out
// the 2026-10-27 deploys. The CDN keeps each rendered page for six hours (next.config.ts headers).
export const dynamic = 'force-dynamic'
export const metadata: Metadata = pageMetadata('/tools/pay-check')

const FAQ = [
  { q: 'How does the pay check work?', a: 'You pick a job title and enter your yearly pay. We compare it with the pay range employers list in current job postings for that title: the lower quarter, the median and the upper quarter.' },
  { q: 'Where does the pay data come from?', a: 'From current job listings on employers’ own career sites that state a pay range. Hourly pay is converted at 2,080 hours a year, and a listing’s midpoint is used.' },
  { q: 'Is listed pay what people are really paid?', a: 'No. It is what employers advertise. Real pay can be higher or lower, and it varies by city, level, industry and the person.' },
  { q: 'Do I need an account?', a: 'No. The check runs without one, and nothing is saved unless you ask for the result by email.' },
]

export default async function PayCheckPage() {
  const titles = (await getTitleIndex()).filter(hasSalaryPage).map((t) => ({ slug: t.slug, name: t.name })).sort((a, b) => a.name.localeCompare(b.name))
  const choices = journeyChoices('thinking-about-a-move')
    .map((s) => getPersona(s))
    .filter((p): p is NonNullable<ReturnType<typeof getPersona>> => !!p)
    .map((p) => ({ slug: p.slug, label: p.label }))
  return (
    <SeoPage
      trail={[{ name: 'Tools', path: '/tools' }, { name: 'Pay check', path: '/tools/pay-check' }]}
      h1={pageH1('/tools/pay-check', 'Pay check: is your salary in line?')}
      lede="Pick your job title and enter your yearly pay to see where it sits against what employers list for the same title today. Free, no account."
      jsonLd={[
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Pay check', applicationCategory: 'FinanceApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
      ]}
    >
      <PayCheck titles={titles} journeyChoices={choices} />
      <section aria-labelledby="faq" className="mt-12">
        <h2 id="faq" className={H2}>Pay check questions</h2>
        <dl className="mt-4 max-w-3xl space-y-4 text-sm">
          {FAQ.map((f) => (
            <div key={f.q}><dt className="font-medium text-navy">{f.q}</dt><dd className="mt-1 text-muted-foreground">{f.a}</dd></div>
          ))}
        </dl>
        <p className="mt-6 text-sm text-muted-foreground">
          More: <Link href="/salaries" className={LINK}>salary by job title</Link>, <Link href="/tools/severance-calculator" className={LINK}>severance calculator</Link> and <Link href="/tools" className={LINK}>all tools</Link>.
        </p>
      </section>
      <ActionBand title="See jobs ranked for you" body="A free Market Reality Assessment shows how the market reads your résumé, then ranks every open job for you." label="Get my free assessment" href={MARKET_REALITY_START_HREF} event="tool_page_cta_clicked" properties={{ tool: 'pay_check' }} />
    </SeoPage>
  )
}
