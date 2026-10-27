import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SeoPage, H2, LINK, Stat } from '@/components/seo/SeoPage'
import { AuthorByline } from '@/components/seo/AuthorByline'
import { DeadlineEmailBox } from '@/components/cobra-aca/DeadlineEmailBox'
import { LaidOffStart } from '@/components/cobra-aca/LaidOffStart'
import { compare, creditAtCliff, fplAmount, medicaidFplAmount } from '@/lib/cobra-aca/calc'
import { COBRA, MARKETPLACE, MEDICAID, NATIONAL_BENCHMARK, RULES_AS_OF } from '@/lib/cobra-aca/rules'
import { FPL_REGION, MARKETPLACE_LABEL, NON_EXPANSION_STATES, STATE_FACTS, benchmarkChangePct, benchmarkRank, diffFromNational, stateMeetsBar } from '@/lib/cobra-aca/states'
import { getPersona } from '@/lib/constants/personas'
import { journeyChoices } from '@/lib/leads/infer-journey'
import { canonical } from '@/lib/seo/canonical'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'
import { ALL_STATE_CODES, stateFromSlug, stateName, stateSlug } from '@/lib/seo/states'
import { fitDescription } from '@/lib/seo/templates'
import { titleMeta } from '@/lib/seo/title'

// One page per state and DC: is a Marketplace plan cheaper than COBRA there? Only sourced facts (src/lib/cobra-aca/states.ts):
// Medicaid expansion, marketplace type and KFF benchmark premiums, plus worked examples from the IRS table. The page is kept lean
// on purpose: the shared explanation lives on /resources/cobra-aca and the calculator, so what is left here is the state's own numbers
// (scripts/seo/page-quality.py wants under 80% overlap with the sibling state pages). A state without its data is not offered to search
// engines (stateMeetsBar), though all 51 have it today.

export const dynamicParams = false
export function generateStaticParams() {
  return ALL_STATE_CODES.filter((c) => STATE_FACTS[c]).map((c) => ({ state: stateSlug(c) }))
}

type Params = Promise<{ state: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { state } = await params
  const code = stateFromSlug(state)
  if (!code || !STATE_FACTS[code]) return {}
  const f = STATE_FACTS[code]
  const name = stateName(code)
  return {
    title: titleMeta(`COBRA vs ACA in ${name}: Which Costs Less?`),
    description: fitDescription(
      `${name}: the average benchmark Marketplace plan is $${f.benchmark[2026]} a month in 2026, ${f.medicaidExpansion ? 'Medicaid is expanded' : 'Medicaid is not expanded'}. Compare COBRA, the deadlines and what you would pay.`,
      160,
    ),
    ...canonical(`/resources/cobra-aca/${state}`),
    ...(stateMeetsBar(code) ? {} : { robots: { index: false, follow: true } }),
  }
}

const dollars = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

export default async function CobraAcaStatePage({ params }: { params: Params }) {
  const { state } = await params
  const code = stateFromSlug(state)
  if (!code || !STATE_FACTS[code]) notFound()
  const f = STATE_FACTS[code]
  const name = stateName(code)
  const path = `/resources/cobra-aca/${state}`
  const region = FPL_REGION(code)
  const rank = benchmarkRank(code)
  const change = benchmarkChangePct(code)
  const diff = diffFromNational(code)
  const cheaperStates = Object.values(STATE_FACTS).filter((x) => x.benchmark[2026] < f.benchmark[2026]).length
  const increaseMonthly = f.benchmark[2026] - f.benchmark[2025]
  const choices = journeyChoices('laid-off')
    .map((s) => getPersona(s))
    .filter((p): p is NonNullable<ReturnType<typeof getPersona>> => !!p)
    .map((p) => ({ slug: p.slug, label: p.label }))

  // Worked examples for one adult with 2026 coverage: income at 150%, 250% and 350% of the poverty line.
  const fpl1 = fplAmount(2026, 1, region)
  const examples = [150, 250, 350].map((pct) => {
    const income = Math.round((fpl1 * pct) / 100)
    const r = compare({ coverageYear: 2026, state: code, householdSize: 1, annualIncome: income, cobraMonthly: 1, marketplaceMonthly: null })
    return { pct, income, ...r }
  })
  const cliff = creditAtCliff(2026, code)
  const cliff27 = creditAtCliff(2027, code)
  const cliff4 = fplAmount(2026, 4, region) * 4
  const medicaid1 = medicaidFplAmount(1, region) * (MEDICAID.expansionFplPercent / 100)
  const medicaid3 = medicaidFplAmount(3, region) * (MEDICAID.expansionFplPercent / 100)
  const similar = ALL_STATE_CODES.filter((c) => STATE_FACTS[c] && c !== code)
    .sort((a, b) => Math.abs(STATE_FACTS[a].benchmark[2026] - f.benchmark[2026]) - Math.abs(STATE_FACTS[b].benchmark[2026] - f.benchmark[2026]))
    .slice(0, 4)

  const faq = [
    { q: `Is the ACA Marketplace cheaper than COBRA in ${name}?`, a: `It is if your income is low enough for a premium tax credit. In ${name} the average benchmark plan for a 40-year-old costs ${dollars(f.benchmark[2026])} a month in 2026 before any credit. A single adult at ${examples[0].pct}% of the poverty line (${dollars(examples[0].income)} a year) would pay about ${dollars(examples[0].marketplaceAfterCreditMonthly)} a month for it after the credit; at ${examples[2].pct}% (${dollars(examples[2].income)}) about ${dollars(examples[2].marketplaceAfterCreditMonthly)}. Above ${dollars(cliff.income)} there is no credit and the plan costs its full price. Compare with the COBRA premium on your own notice.` },
    { q: `What does crossing the 400% line cost in ${name}?`, a: `For a single adult with 2026 coverage, earning one dollar over ${dollars(cliff.income)} removes a credit of about ${dollars(cliff.creditMonthly)} a month (${dollars(cliff.creditMonthly * 12)} a year) on the ${dollars(f.benchmark[2026])} benchmark plan. For 2027 coverage the line moves to ${dollars(cliff27.income)}.` },
    { q: f.medicaidExpansion ? `Can I qualify for Medicaid in ${name} after a layoff?` : `What if my income is very low in ${name}?`, a: f.medicaidExpansion ? `${name} expanded Medicaid, so adults 19 to 64 with income up to ${MEDICAID.expansionFplPercent}% of the poverty line can qualify: about ${dollars(medicaid1)} a year for one person and ${dollars(medicaid3)} for three in 2026. Medicaid is decided on your income this month and you can apply at any time.` : `${name} has not expanded Medicaid. ${f.waiverToFpl100 ? `Adults up to 100% of the poverty line are covered through a waiver, and credits start at 100%, so there is no gap for most adults. Check the waiver’s rules with the state.` : 'Adults below 100% of the poverty line generally get neither Medicaid nor Marketplace credits. Parents and people with disabilities have other routes; ask the state Medicaid office.'}` },
  ]

  return (
    <SeoPage
      trail={[{ name: 'Resources', path: '/resources' }, { name: 'COBRA vs ACA', path: '/resources/cobra-aca' }, { name, path }]}
      h1={`COBRA vs ACA in ${name}: which costs less?`}
      lede={
        <>
          <p>
            In {name} the average benchmark Marketplace plan for a 40-year-old costs {dollars(f.benchmark[2026])} a month in 2026 before any credit, {diff >= 0 ? `${dollars(diff)} above` : `${dollars(-diff)} below`} the {dollars(NATIONAL_BENCHMARK[2026])} national average.{' '}
            {f.medicaidExpansion ? `${name} expanded Medicaid, so very low incomes may qualify for it.` : `${name} has not expanded Medicaid.`} Whether COBRA or the Marketplace costs you less depends on your income for the year.
          </p>
          <AuthorByline updated={RULES_AS_OF} className="mt-4" />
        </>
      }
      jsonLd={[
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })) },
        breadcrumbJsonLd([{ name: 'Resources', path: '/resources' }, { name: 'COBRA vs ACA', path: '/resources/cobra-aca' }, { name, path }]),
      ]}
    >
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat value={dollars(f.benchmark[2026])} label="Average benchmark plan, a month, 2026" note={`${change >= 0 ? 'Up' : 'Down'} ${Math.abs(change)}% from ${dollars(f.benchmark[2025])} in 2025`} />
        <Stat value={`#${rank} of 51`} label="By 2026 benchmark premium, highest first" note={`${cheaperStates} states and DC cost less`} />
        <Stat value={dollars(cliff.income)} label="Credit ends above, one person, 2026" note={`${dollars(cliff4)} for a family of four`} />
        <Stat value={`${dollars(cliff.creditMonthly)} a month`} label="Credit lost by crossing that line" note={`on the ${dollars(f.benchmark[2026])} plan`} />
      </ul>

      <section aria-labelledby="examples" className="mt-12">
        <h2 id="examples" className={H2}>What a single adult would pay in {name}</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Coverage in 2026, the {dollars(f.benchmark[2026])} benchmark plan and the IRS table. Estimates; the calculator takes your own numbers.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <caption className="sr-only">Estimated monthly Marketplace cost for one adult in {name} at three incomes</caption>
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="border-b border-border py-2 pr-3 font-medium">Yearly income</th>
                <th scope="col" className="border-b border-border py-2 pr-3 font-medium">Poverty line</th>
                <th scope="col" className="border-b border-border py-2 pr-3 font-medium">Expected share</th>
                <th scope="col" className="border-b border-border py-2 pr-3 font-medium">Credit a month</th>
                <th scope="col" className="border-b border-border py-2 font-medium">You pay a month</th>
              </tr>
            </thead>
            <tbody>
              {examples.map((e) => (
                <tr key={e.pct}>
                  <th scope="row" className="border-b border-border py-2 pr-3 text-left font-medium text-navy">{dollars(e.income)}</th>
                  <td className="border-b border-border py-2 pr-3 tabular-nums text-muted-foreground">{e.pct}%</td>
                  <td className="border-b border-border py-2 pr-3 tabular-nums text-muted-foreground">{e.expectedShareOfIncome !== null ? `${(e.expectedShareOfIncome * 100).toFixed(1)}%` : 'none'}</td>
                  <td className="border-b border-border py-2 pr-3 tabular-nums text-muted-foreground">{dollars(e.creditMonthly)}</td>
                  <td className="border-b border-border py-2 tabular-nums text-muted-foreground">{dollars(e.marketplaceAfterCreditMonthly)}</td>
                </tr>
              ))}
              <tr>
                <th scope="row" className="py-2 pr-3 text-left font-medium text-navy">Over {dollars(cliff.income)}</th>
                <td className="py-2 pr-3 tabular-nums text-muted-foreground">Over 400%</td>
                <td className="py-2 pr-3 text-muted-foreground">none</td>
                <td className="py-2 pr-3 tabular-nums text-muted-foreground">$0</td>
                <td className="py-2 tabular-nums text-muted-foreground">{dollars(f.benchmark[2026])}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
          The benchmark plan rose {dollars(increaseMonthly)} a month ({dollars(increaseMonthly * 12)} a year) from 2025 to 2026. People under the 400% line were not charged for that: their credit grew to cover it. People above it paid it all. For 2027 coverage the line moves to {dollars(cliff27.income)} for one person, where a credit of about {dollars(cliff27.creditMonthly)} a month would still be lost if the 2026 benchmark price held.
        </p>
      </section>

      <section aria-labelledby="where" className="mt-12">
        <h2 id="where" className={H2}>{name} compared</h2>
        <p className="mt-3 max-w-3xl text-base text-muted-foreground">
          {name} ranks {rank} of 51 on 2026 benchmark premium; {cheaperStates} cost less. {name} {MARKETPLACE_LABEL[f.marketplace]}.{' '}
          {f.medicaidExpansion
            ? `Medicaid is expanded: adults up to ${MEDICAID.expansionFplPercent}% of the poverty line (${dollars(medicaid1)} for one person, ${dollars(medicaid3)} for three in 2026) may qualify, decided on this month’s income, and you can apply at any time.`
            : f.waiverToFpl100
              ? `Medicaid is not expanded, but adults up to 100% of the poverty line are covered through a waiver, so most adults do not fall into a coverage gap.`
              : `Medicaid is not expanded: adults below 100% of the poverty line generally get neither Medicaid nor credits, and for 2026 coverage credits start at ${dollars(fpl1)} of income for one person. ${NON_EXPANSION_STATES.length} states are in this position.`}
        </p>
        <ul className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {similar.map((c) => (
            <li key={c}>
              <Link href={`/resources/cobra-aca/${stateSlug(c)}`} className={LINK}>{stateName(c)}</Link>
              <span className="text-muted-foreground"> {dollars(STATE_FACTS[c].benchmark[2026])} a month, {STATE_FACTS[c].medicaidExpansion ? 'Medicaid expanded' : 'Medicaid not expanded'}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="deadlines" className="mt-12 max-w-3xl">
        <h2 id="deadlines" className={H2}>Your {COBRA.electionDays} days</h2>
        <p className="mt-3 text-base text-muted-foreground">
          In {name}, as everywhere, federal COBRA covers employers with {COBRA.minEmployees} or more employees; a state law may cover smaller ones (ask the{' '}
          <a href="https://content.naic.org/state-insurance-departments" rel="noopener" className={LINK}>{name} insurance department</a>). You have {COBRA.electionDays} days to elect COBRA and {MARKETPLACE.specialEnrollmentDays} days after coverage ends to join a Marketplace plan. Details and sources are on the{' '}
          <Link href="/resources/cobra-aca" className={LINK}>COBRA vs ACA explainer</Link>.
        </p>
        <div className="mt-4 max-w-xl">
          <DeadlineEmailBox source="cobra_vs_aca:state" state={code} journeyChoices={choices} />
        </div>
      </section>

      <section aria-labelledby="faq" className="mt-12">
        <h2 id="faq" className={H2}>Questions about COBRA vs ACA in {name}</h2>
        <dl className="mt-4 max-w-3xl space-y-5 text-sm">
          {faq.map((x) => (
            <div key={x.q}>
              <dt className="font-medium text-navy">{x.q}</dt>
              <dd className="mt-1 text-muted-foreground">{x.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="next" className="mt-12 rounded-xl border border-border bg-white p-6">
        <h2 id="next" className="text-xl font-semibold tracking-tight text-navy">Compare with your own numbers</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Enter your COBRA quote and your household income. Also: <Link href={`/unemployment-benefits/${state}`} className={LINK}>unemployment benefits in {name}</Link>.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Link
            href={`/tools/cobra-vs-aca-calculator?state=${code}`}
            className="inline-flex h-12 items-center rounded-full bg-action px-6 text-base font-semibold text-action-foreground hover:brightness-95"
          >
            Open the calculator for {name}
          </Link>
          <LaidOffStart placement="state_page" label="Or get your free Market Reality Assessment" />
        </div>
      </section>

      <p className="mt-10 max-w-3xl text-xs text-muted-foreground">
        Premiums: KFF, marketplace average monthly benchmark premiums, read {RULES_AS_OF}. Credit rules: IRS Rev. Proc. 2025-25 and 2026-26. Full list of sources on the{' '}
        <Link href="/resources/cobra-aca#sources" className={LINK}>explainer</Link>. An estimate, not advice.
      </p>
    </SeoPage>
  )
}
