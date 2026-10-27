import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
import { AuthorByline } from '@/components/seo/AuthorByline'
import { DeadlineEmailBox } from '@/components/cobra-aca/DeadlineEmailBox'
import { LaidOffStart } from '@/components/cobra-aca/LaidOffStart'
import { SeveranceSources } from '@/components/severance/SeveranceSources'
import { money } from '@/lib/cobra-aca/calc'
import { getPersona } from '@/lib/constants/personas'
import { journeyChoices } from '@/lib/leads/infer-journey'
import { netSeverance, TREATMENT_LABEL } from '@/lib/severance/calc'
import { SEVERANCE_RULES_AS_OF, SURVEYS, WAIVER, WARN, WITHHOLDING } from '@/lib/severance/rules'
import { groupByTreatment } from '@/lib/severance/state-groups'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'

// The severance explainer: ungated, answer first, sourced. Figures and rules: src/lib/severance/rules.ts; how each state treats severance for
// unemployment: src/lib/data/state-ui.ts. Claim-by-claim sources: docs/PATTERN_UNEMPLOYMENT_SEVERANCE.md and the Sources section below.

export const metadata: Metadata = pageMetadata('/resources/severance-pay')

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`

export default function SeverancePayPage() {
  const groups = groupByTreatment()
  const counts = (t: string | null) => groups.find((g) => g.treatment === t)?.states.length ?? 0
  const example = netSeverance({ gross: 60_000 })
  const choices = journeyChoices('laid-off')
    .map((s) => getPersona(s))
    .filter((p): p is NonNullable<ReturnType<typeof getPersona>> => !!p)
    .map((p) => ({ slug: p.slug, label: p.label }))

  const FAQ = [
    { q: 'Do employers have to pay severance?', a: 'Not under federal law. The Department of Labor says there is no requirement in the Fair Labor Standards Act for severance pay and that it is a matter of agreement between an employer and an employee. A contract, a company plan or a union agreement can create the obligation.' },
    { q: 'Is severance taxed more than regular pay?', a: `Not by a special tax, but it is withheld differently. Severance is wages, so Social Security and Medicare apply, and many employers withhold federal income tax at the flat ${pct(WITHHOLDING.supplementalRate)} rate for supplemental wages (${pct(WITHHOLDING.supplementalRateOver)} on the part over $1 million in a year). That rate can be more or less than your real tax rate; the difference comes back as a refund or is owed when you file.` },
    { q: 'How long do I have to sign a severance agreement?', a: `If you are ${WAIVER.minAge} or older and the agreement asks you to give up age-discrimination claims, it must give you at least ${WAIVER.considerDays} days to consider it, or ${WAIVER.considerDaysGroup} days if it is part of a group exit incentive or termination program, and ${WAIVER.revokeDays} days after you sign to revoke. You may sign sooner if you choose to, but the employer cannot pressure you into it. Other agreements and younger employees are not covered by this federal rule; check the agreement and your state.` },
    { q: 'Can I collect unemployment if I get severance?', a: `It depends on the state. In the Department of Labor’s comparison of state laws, ${counts('not_deductible')} states do not deduct severance, ${counts('depends')} depend on how it is paid, ${counts('reduces')} reduce your benefit and ${counts('disqualifies')} can make you ineligible for the weeks it applies to; for ${counts(null)} states the sources disagree. File right away either way and report the severance when asked. Your state’s page shows its own rule and its source.` },
    { q: 'Is a lump sum or salary continuation better?', a: 'Neither is better for everyone. In some states unemployment treats a lump sum differently from pay spread over a period, and a period of continued pay can keep your health coverage and your status as an employee going. Ask for the form that fits your state’s unemployment rule and your health coverage, and have the agreement say which weeks the payment covers.' },
    { q: 'What is the WARN Act, and does it change my severance?', a: `If your employer has ${WARN.minEmployees} or more employees and closes a site or lays off a large group, it must give ${WARN.noticeDays} days’ written notice. An employer that skips it owes back pay and benefits for each day of violation, up to ${WARN.maxBackPayDays} days. Pay in lieu of notice is separate from severance and some states count it differently for unemployment.` },
  ]

  return (
    <SeoPage
      trail={[{ name: 'Resources', path: '/resources' }, { name: 'Severance pay', path: '/resources/severance-pay' }]}
      h1={pageH1('/resources/severance-pay', 'Severance pay: taxes, your agreement and what is typical')}
      lede={
        <>
          <p>
            No federal law requires severance, so what you get is what you negotiate or what a plan promises. It is taxed as wages, a severance agreement can come with a fixed review period, and
            whether it affects unemployment depends on your state. This page puts those in the order you will meet them, with the source for every figure.
          </p>
          <AuthorByline updated={SEVERANCE_RULES_AS_OF} className="mt-4" />
        </>
      }
      jsonLd={[
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        breadcrumbJsonLd([{ name: 'Resources', path: '/resources' }, { name: 'Severance pay', path: '/resources/severance-pay' }]),
      ]}
    >
      <section aria-labelledby="short" className="mt-8">
        <h2 id="short" className={H2}>The short answer</h2>
        <ul className="mt-4 max-w-3xl list-disc space-y-2 pl-5 text-base text-navy">
          <li>Severance is not required by federal law. It is whatever your contract, your company’s plan or the agreement you negotiate says.</li>
          <li>
            It is taxed as wages. For a {money(60_000)} lump sum with no earlier pay this year and no state tax, about {money(example.federalIncomeTax)} is withheld for federal income tax, {money(example.socialSecurity + example.medicare)} for
            Social Security and Medicare, and you take home about {money(example.net)}. <Link href="/tools/severance-calculator" className={LINK}>Run your own numbers</Link>.
          </li>
          <li>
            Read the clock before you sign: at {WAIVER.minAge} or older you get at least {WAIVER.considerDays} days to consider an agreement ({WAIVER.considerDaysGroup} in a group layoff) and {WAIVER.revokeDays} days after signing to change your mind.
          </li>
          <li>
            Unemployment: {counts('not_deductible')} states do not deduct severance, {counts('depends')} depend on how it is paid, {counts('reduces')} reduce your benefit and {counts('disqualifies')} can make you ineligible for the weeks it applies to.{' '}
            <Link href="/unemployment-benefits#severance" className={LINK}>Find your state</Link>.
          </li>
        </ul>
      </section>

      <section aria-labelledby="required" className="mt-12">
        <h2 id="required" className={H2}>Does an employer have to pay it?</h2>
        <div className="mt-4 max-w-3xl space-y-3 text-base leading-relaxed text-navy">
          <p>
            No. The Department of Labor: “There is no requirement in the Fair Labor Standards Act (FLSA) for severance pay. Severance pay is a matter of agreement between an employer and an employee.” If your employment contract, an
            employer-sponsored plan or a union agreement promises severance, the promise is enforceable, and the Employee Benefits Security Administration may help an employee who did not receive severance under an employer-sponsored plan.
          </p>
          <p>
            Two things are often confused with severance. <span className="font-semibold">Pay in lieu of notice</span> replaces the {WARN.noticeDays} days’ notice that WARN requires for large layoffs. <span className="font-semibold">Accrued vacation or
            paid time off</span> is wages you already earned, paid out or not depending on your state and your employer’s policy. Both can be on the same check as severance, and some states treat them differently for unemployment.
          </p>
        </div>
      </section>

      <section aria-labelledby="typical" className="mt-12">
        <h2 id="typical" className={H2}>What is typical?</h2>
        <div className="mt-4 max-w-3xl space-y-3 text-base leading-relaxed text-navy">
          <p>
            There is no official statistic, so these are the two surveys we could verify and what each measures. They are not the same thing and neither is a national per-year figure.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <span className="font-semibold">By formula, Michigan employers, 2024:</span> one week of pay per year of service was the most common formula ({pct(SURVEYS.oneWeekPerYearShare)} of employers), then two weeks per year ({pct(SURVEYS.twoWeeksPerYearShare)}).
              The survey covered 125 Michigan organizations (ASE).
            </li>
            <li>
              <span className="font-semibold">By total length, 2024 data:</span> Challenger, Gray &amp; Christmas reports the average total severance rose to {SURVEYS.averageTotalWeeks} weeks from {SURVEYS.priorAverageTotalWeeks} the year before, with individual
              contributors getting under {SURVEYS.individualContributorWeeksUnder} weeks on average and vice presidents and directors 15 to 25. Its data comes from thousands of packages, a sample that skews toward people at senior levels.
            </li>
          </ul>
          <p>
            Years of service is the most common basis, but level, role and what the company wants from you in return matter too. The{' '}
            <Link href="/tools/severance-calculator" className={LINK}>severance calculator</Link> turns a weeks-per-year offer into dollars and shows what is left after withholding.
          </p>
        </div>
      </section>

      <section aria-labelledby="taxes" className="mt-12">
        <h2 id="taxes" className={H2}>Taxes: what is withheld</h2>
        <div className="mt-4 max-w-3xl space-y-3 text-base leading-relaxed text-navy">
          <p>
            The IRS: “Severance payments are wages subject to social security and Medicare taxes, federal income tax withholding, and FUTA tax.” For {WITHHOLDING.taxYear}:
          </p>
          <div className="overflow-x-auto rounded-xl border border-border bg-white">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Federal withholding and payroll taxes on severance, {WITHHOLDING.taxYear}</caption>
              <thead className="bg-off-white text-navy">
                <tr><th className="px-4 py-2 font-semibold">Tax</th><th className="px-4 py-2 font-semibold">Rate</th><th className="px-4 py-2 font-semibold">Applies to</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr><td className="px-4 py-2">Federal income tax withholding (flat method)</td><td className="px-4 py-2">{pct(WITHHOLDING.supplementalRate)}</td><td className="px-4 py-2">Supplemental wages; {pct(WITHHOLDING.supplementalRateOver)} on the part over {money(WITHHOLDING.supplementalThreshold)} in the year</td></tr>
                <tr><td className="px-4 py-2">Social Security</td><td className="px-4 py-2">{pct(WITHHOLDING.socialSecurityRate)}</td><td className="px-4 py-2">Wages up to {money(WITHHOLDING.socialSecurityWageBase)} for the year</td></tr>
                <tr><td className="px-4 py-2">Medicare</td><td className="px-4 py-2">{(WITHHOLDING.medicareRate * 100).toFixed(2)}%</td><td className="px-4 py-2">All wages</td></tr>
                <tr><td className="px-4 py-2">Additional Medicare</td><td className="px-4 py-2">{pct(WITHHOLDING.additionalMedicareRate)}</td><td className="px-4 py-2">Wages over {money(WITHHOLDING.additionalMedicareThreshold)} in the year</td></tr>
              </tbody>
            </table>
          </div>
          <p>
            Your state may also withhold income tax. Withholding is a prepayment, not your tax: if the flat rate is higher than your real rate you get the difference back when you file, and if it is lower you owe it. Unemployment benefits you collect are
            taxable income too.
          </p>
        </div>
      </section>

      <section aria-labelledby="agreement-h" id="agreement" className="mt-12">
        <h2 id="agreement-h" className={H2}>Before you sign: the agreement</h2>
        <div className="mt-4 max-w-3xl space-y-3 text-base leading-relaxed text-navy">
          <p>
            Most severance comes with a release: you get the money and agree not to sue. If you are {WAIVER.minAge} or older and the release covers age-discrimination claims, federal law (the Older Workers Benefit Protection Act) sets rules the EEOC summarizes:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li><span className="font-semibold">{WAIVER.considerDays} days to consider</span> an individual offer, counted from the employer’s final offer. A material change to the offer restarts the period.</li>
            <li><span className="font-semibold">{WAIVER.considerDaysGroup} days</span> when it is part of a group exit incentive or termination program, and the employer must tell you in writing the group it was chosen from, the eligibility factors and time limits, and the job titles and ages of those selected and not selected.</li>
            <li><span className="font-semibold">{WAIVER.revokeDays} days to revoke</span> after you sign. Neither side can change that period.</li>
            <li>The agreement must <span className="font-semibold">advise you in writing to consult an attorney</span> before you accept it.</li>
            <li>You may sign before the period ends, but only if the choice is knowing and voluntary; the employer may not pressure you with a threat to withdraw the offer or by giving different terms to people who sign early.</li>
          </ul>
          <p>
            Employees under {WAIVER.minAge} are not covered by that rule, and an agreement may give you more time than the law requires. This is general information, not legal advice; an employment lawyer can read an
            agreement in a short session, and many offer a first review.
          </p>
        </div>
      </section>

      <section aria-labelledby="negotiate" className="mt-12">
        <h2 id="negotiate" className={H2}>What to ask for</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Offers are often negotiable. A list of items worth raising, none of them a promise that an employer will agree:</p>
        <ul className="mt-4 max-w-3xl list-disc space-y-2 pl-5 text-base text-navy">
          <li><span className="font-semibold">The amount, and how it is calculated:</span> weeks per year of service, and whether it is a lump sum or continued pay.</li>
          <li><span className="font-semibold">Health coverage:</span> months of employer-paid coverage or a COBRA subsidy. See <Link href="/resources/cobra-aca" className={LINK}>COBRA vs ACA</Link> before you decide what coverage to ask for.</li>
          <li><span className="font-semibold">Timing of a bonus, commission or equity vest</span> that falls close to your last day, and payout of unused vacation.</li>
          <li><span className="font-semibold">How the separation is described,</span> in the agreement and to anyone who calls for a reference, and a neutral reference letter.</li>
          <li><span className="font-semibold">The terms you give up:</span> the scope of the release, any non-compete or non-solicit, confidentiality and non-disparagement, and whether the agreement says which weeks the payment covers, which matters for unemployment.</li>
          <li><span className="font-semibold">Extras:</span> outplacement or career coaching, keeping your laptop or phone number, and more time to decide.</li>
        </ul>
      </section>

      <section aria-labelledby="unemployment" className="mt-12">
        <h2 id="unemployment" className={H2}>Severance and unemployment, by state</h2>
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-navy">
          States differ on whether severance reduces unemployment benefits, so file the week you lose your job and report the severance when asked: the agency decides how it counts. From the Department of Labor’s comparison of
          state laws and each state agency:
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {groups.map((g) => (
            <div key={g.treatment ?? 'unconfirmed'} className="rounded-xl border border-border bg-white p-4">
              <h3 className="text-base font-semibold text-navy">
                {g.treatment ? TREATMENT_LABEL[g.treatment] : 'Not confirmed: check with the state'} <span className="font-normal text-muted-foreground">({g.states.length})</span>
              </h3>
              <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                {g.states.map((r) => (
                  <li key={r.code}>
                    <Link href={`/unemployment-benefits/${r.slug}`} className={LINK}>{r.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="warn" className="mt-12">
        <h2 id="warn" className={H2}>If it is a large layoff: the WARN Act</h2>
        <div className="mt-4 max-w-3xl space-y-3 text-base leading-relaxed text-navy">
          <p>
            Employers with {WARN.minEmployees} or more employees (not counting part-time) must give {WARN.noticeDays} days’ written notice of a plant closing, where {WARN.plantClosingEmployees} or more people lose their jobs at one site in 30 days, or a mass layoff of at least{' '}
            {Math.round(WARN.massLayoffShare * 100)}% of a site’s employees and at least {WARN.massLayoffEmployees}, or of {WARN.massLayoffAlways} or more. An employer that does not give the notice owes affected employees back pay and benefits for each day of violation,
            up to {WARN.maxBackPayDays} days, reduced by wages and voluntary payments made for the period. Check the <Link href="/tools/warn-act-checker" className={LINK}>WARN Act checker</Link> and the{' '}
            <Link href="/layoffs" className={LINK}>layoff tracker</Link>.
          </p>
        </div>
      </section>

      <section aria-labelledby="faq" className="mt-12">
        <h2 id="faq" className={H2}>Severance questions</h2>
        <dl className="mt-4 max-w-3xl space-y-5 text-base">
          {FAQ.map((f) => (
            <div key={f.q}>
              <dt className="font-semibold text-navy">{f.q}</dt>
              <dd className="mt-1 leading-relaxed text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="next" className="mt-12">
        <h2 id="next" className={H2}>Get the dates in your inbox</h2>
        <div className="mt-4 max-w-xl">
          <DeadlineEmailBox
            source="severance:explainer"
            journeyChoices={choices}
            eventPrefix="severance"
            blurb="One email as each date comes up over the next two months: filing for unemployment, the severance agreement review, health coverage. Then nothing. No account needed."
          />
        </div>
        <div className="mt-4">
          <LaidOffStart placement="severance_explainer" eventPrefix="severance" />
        </div>
        <p className="mt-6 max-w-3xl text-sm text-muted-foreground">
          Also: <Link href="/topics/severance" className={LINK}>severance package: what it includes and how to negotiate</Link>, <Link href="/resources/cobra-aca" className={LINK}>health insurance after a layoff</Link>,{' '}
          <Link href="/unemployment-benefits" className={LINK}>unemployment benefits by state</Link> and <Link href="/resources/unemployed" className={LINK}>what to do in the first week</Link>.
        </p>
      </section>

      <SeveranceSources />
      <p className="mt-6 max-w-3xl text-xs text-muted-foreground">This page is general information, not legal or tax advice. Read on {SEVERANCE_RULES_AS_OF}.</p>
    </SeoPage>
  )
}
