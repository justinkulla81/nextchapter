import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK, ActionBand } from '@/components/seo/SeoPage'
import { SalaryConverter } from '@/components/tools/SalaryConverter'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'

export const metadata: Metadata = pageMetadata('/tools/salary-converter')

const FAQ = [
  { q: 'How do I convert hourly pay to a yearly salary?', a: 'Multiply the hourly rate by the hours you work in a week and by the weeks you are paid in a year. At 40 hours for 52 weeks that is the hourly rate times 2,080, so $25 an hour is $52,000 a year.' },
  { q: 'How do I convert a yearly salary to an hourly rate?', a: 'Divide the yearly pay by the hours you work in a year. For a full-time schedule, divide by 2,080, so $104,000 a year is $50 an hour.' },
  { q: 'Why does my number differ from my paycheck?', a: 'This is pay before taxes and deductions. Unpaid time off, an unpaid week or a different schedule changes the weeks paid, so set the hours and weeks above to match yours.' },
  { q: 'What counts as a month or two weeks of pay?', a: 'A month is one twelfth of the year, and two weeks of pay is two weeks of the schedule above, so a yearly salary has 26 two-week pay periods when you are paid 52 weeks.' },
]

export default function Page() {

  return (
    <SeoPage
      trail={[{ name: 'Tools', path: '/tools' }, { name: 'Salary converter', path: '/tools/salary-converter' }]}
      h1={pageH1('/tools/salary-converter', 'Salary converter: hourly to yearly and back')}
      lede="Turn hourly pay into yearly, monthly, weekly and daily pay, or any of them into the others. Change the hours and weeks to match a part-time or seasonal schedule."
      jsonLd={[
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Salary converter', applicationCategory: 'FinanceApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
      ]}
    >
      <SalaryConverter />
      <section aria-labelledby="faq" className="mt-12">
        <h2 id="faq" className={H2}>Salary converter questions</h2>
        <dl className="mt-4 max-w-3xl space-y-4 text-sm">
          {FAQ.map((f) => (
            <div key={f.q}><dt className="font-medium text-navy">{f.q}</dt><dd className="mt-1 text-muted-foreground">{f.a}</dd></div>
          ))}
        </dl>
        <p className="mt-6 text-sm text-muted-foreground">
          More: <Link href="/tools/pay-check" className={LINK}>pay check: is your salary in line</Link>, <Link href="/salaries" className={LINK}>salaries by job title</Link> and <Link href="/tools/severance-calculator" className={LINK}>severance calculator</Link>.
        </p>
      </section>
      <ActionBand title="Know what the market pays your title" body="A free Market Reality Assessment and a weekly plan that starts with the deadlines." label="Get my free assessment" href={MARKET_REALITY_START_HREF} event="tool_page_cta_clicked" properties={{ tool: 'salary_converter' }} />
    </SeoPage>
  )
}
