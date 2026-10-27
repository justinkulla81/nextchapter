import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
import { DeadlineEmailBox } from '@/components/cobra-aca/DeadlineEmailBox'
import { LaidOffStart } from '@/components/cobra-aca/LaidOffStart'
import { SeveranceCalculator, type CalculatorState } from '@/components/tools/SeveranceCalculator'
import { SeveranceSources } from '@/components/severance/SeveranceSources'
import { getPersona } from '@/lib/constants/personas'
import { journeyChoices } from '@/lib/leads/infer-journey'
import { WAIVER, WITHHOLDING } from '@/lib/severance/rules'
import { severanceByState } from '@/lib/severance/state-groups'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'

export const metadata: Metadata = pageMetadata('/tools/severance-calculator')

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`

const FAQ = [
  { q: 'How much severance should I get?', a: 'There is no required amount: the Department of Labor says severance is a matter of agreement between an employer and an employee. A common formula is one week of pay per year of service (the most common formula in a 2024 survey of 125 Michigan employers, followed by two weeks), and senior roles often get more. Your contract, a company plan or the agreement you are offered sets the amount.' },
  { q: 'Is severance pay taxed?', a: `Yes, as wages. Social Security and Medicare apply, and many employers withhold federal income tax at the flat ${pct(WITHHOLDING.supplementalRate)} rate for supplemental wages (${pct(WITHHOLDING.supplementalRateOver)} on the part over $1 million in a year). Your state may withhold too. The calculator shows these as withholding, which is a prepayment: your real tax is settled when you file.` },
  { q: 'Does severance affect unemployment benefits?', a: 'In some states it does. Choose your state in the calculator, or open its unemployment page, to see its own rule and the source. File right away either way and report the severance when asked.' },
  { q: 'How long do I have to consider a severance agreement?', a: `If you are ${WAIVER.minAge} or older and the agreement asks you to give up age-discrimination claims, at least ${WAIVER.considerDays} days (${WAIVER.considerDaysGroup} in a group layoff program), and then ${WAIVER.revokeDays} days after signing to revoke. Enter the date you received the offer to see yours.` },
  { q: 'Can I negotiate severance?', a: 'Yes. Offers are often negotiable, especially the amount, months of health coverage and the timing of a bonus or equity vest. See the severance pay guide for a list of what to ask for.' },
]

export default function SeveranceCalculatorPage() {
  const states: CalculatorState[] = severanceByState().map((r) => ({ code: r.code, name: r.name, slug: r.slug, treatment: r.treatment, text: r.text }))
  const choices = journeyChoices('laid-off')
    .map((s) => getPersona(s))
    .filter((p): p is NonNullable<ReturnType<typeof getPersona>> => !!p)
    .map((p) => ({ slug: p.slug, label: p.label }))

  return (
    <SeoPage
      trail={[{ name: 'Tools', path: '/tools' }, { name: 'Severance calculator', path: '/tools/severance-calculator' }]}
      h1={pageH1('/tools/severance-calculator', 'Severance calculator')}
      lede="Enter your pay and years of service to see what the common formula of one to two weeks of pay per year of service comes to, what is left after federal withholding and payroll taxes, and how your state treats severance for unemployment. Your agreement sets the real number."
      jsonLd={[
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Severance calculator', applicationCategory: 'FinanceApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
      ]}
    >
      <SeveranceCalculator states={states} />

      <section aria-labelledby="faq" className="mt-12">
        <h2 id="faq" className={H2}>Severance pay questions</h2>
        <dl className="mt-4 max-w-3xl space-y-4 text-sm">
          {FAQ.map((f) => (
            <div key={f.q}><dt className="font-medium text-navy">{f.q}</dt><dd className="mt-1 text-muted-foreground">{f.a}</dd></div>
          ))}
        </dl>
        <p className="mt-6 text-sm text-muted-foreground">
          More: <Link href="/resources/severance-pay" className={LINK}>severance pay: taxes, your agreement and what is typical</Link>, <Link href="/topics/severance" className={LINK}>severance package: what it is and how to negotiate</Link>,{' '}
          <Link href="/unemployment-benefits" className={LINK}>unemployment benefits by state</Link>, <Link href="/resources/cobra-aca" className={LINK}>health insurance after a layoff</Link> and{' '}
          <Link href="/tools/cobra-vs-aca-calculator" className={LINK}>the COBRA vs ACA calculator</Link>.
        </p>
      </section>

      <section aria-labelledby="next" className="mt-12">
        <h2 id="next" className={H2}>Plan the weeks after a layoff</h2>
        <div className="mt-4 max-w-xl">
          <DeadlineEmailBox
            source="severance:tool"
            journeyChoices={choices}
            eventPrefix="severance"
            blurb="One email as each date comes up over the next two months: filing for unemployment, the severance agreement review, health coverage. Then nothing. No account needed."
          />
        </div>
        <div className="mt-4">
          <LaidOffStart placement="severance_tool" eventPrefix="severance" />
        </div>
      </section>

      <SeveranceSources />
    </SeoPage>
  )
}
