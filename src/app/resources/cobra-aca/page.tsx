import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
import { AuthorByline } from '@/components/seo/AuthorByline'
import { GuideEmailGate } from '@/components/guides/GuideEmailGate'
import { DeadlineEmailBox } from '@/components/cobra-aca/DeadlineEmailBox'
import { LaidOffStart } from '@/components/cobra-aca/LaidOffStart'
import { SourcesList } from '@/components/cobra-aca/SourcesList'
import { fplAmount, medicaidFplAmount, money } from '@/lib/cobra-aca/calc'
import { COBRA, FPL, MARKETPLACE, MEDICAID, NATIONAL_BENCHMARK, PTC, RULES_AS_OF } from '@/lib/cobra-aca/rules'
import { NON_EXPANSION_STATES, STATE_FACTS } from '@/lib/cobra-aca/states'
import { getPersona } from '@/lib/constants/personas'
import { journeyChoices } from '@/lib/leads/infer-journey'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'

// The COBRA vs ACA explainer. It replaces the thin, email-gated guide page at the same address (the gated PDF is kept as an optional
// extra at the bottom), so the impressions that address already has carry over. Rules and figures: src/lib/cobra-aca/rules.ts;
// sources: docs/COBRA_VS_ACA_SOURCES.md and the Sources section below.

export const metadata: Metadata = pageMetadata('/resources/cobra-aca')

const UPDATED = RULES_AS_OF

const FAQ = [
  { q: 'Is COBRA or the ACA Marketplace cheaper?', a: `It depends mostly on your income. COBRA costs the whole premium: your share, your employer's share and up to 2% on top (up to ${Math.round(COBRA.premiumShareOfPlanCost * 100)}% of what the plan costs). A Marketplace plan costs less if your household income is low enough to get a premium tax credit, which for 2026 and 2027 means no more than 400% of the federal poverty line. Above that line there is no credit and the Marketplace plan costs its full price. Use the calculator with your own COBRA quote.` },
  { q: 'How long do I have to choose COBRA?', a: `You have ${COBRA.electionDays} days, counted from the later of the day your coverage ends and the day you get your COBRA election notice. If you elect, your first payment is due within ${COBRA.firstPaymentDays} days of electing, and coverage is back-dated to the day your job-based coverage ended.` },
  { q: 'How long do I have to join a Marketplace plan after losing my job?', a: `${MARKETPLACE.specialEnrollmentDays} days after your job-based coverage ends. If you pick a plan before your coverage ends it can start the first day of the month after you lose coverage. If you pick after, it starts the first day of the month after you pick. You then have ${MARKETPLACE.documentDays} days to send documents showing you qualify.` },
  { q: 'Can I take COBRA and switch to the Marketplace later?', a: 'Only at open enrollment, or if COBRA coverage ends. Cancelling COBRA yourself before it ends does not open a special enrollment window. People who want to try COBRA first and move later should know that the Marketplace window tied to losing job-based coverage is the 60 days after it ends.' },
  { q: 'Can I get a Marketplace credit if I am on COBRA?', a: 'Generally not for the months you are enrolled in it. The IRS treats enrolling in employer coverage as ruling out the credit, and COBRA is employer coverage. You can decline COBRA and apply for the credit instead.' },
  { q: 'Did the enhanced ACA subsidies expire?', a: 'Yes for the rules in the IRS tables for 2026 and 2027. The temporary rules for 2021 through 2025 removed the 400% of poverty cap; the IRS tables for 2026 and 2027 (Rev. Proc. 2025-25 and 2026-26) have the cap back. Congress could change this, so check the IRS page linked under Sources before you decide.' },
  { q: 'Do unemployment benefits and severance count as income for the credit?', a: 'Yes. The credit is based on your income for the whole year in which you need coverage, which includes pay you have already earned this year, severance and unemployment compensation (the IRS treats unemployment compensation as taxable income). Estimate the whole year, not your income since the layoff.' },
  { q: 'What if I have little or no income after the layoff?', a: `In a state that expanded Medicaid, adults up to ${MEDICAID.expansionFplPercent}% of the poverty line can qualify for Medicaid, which is decided on your income this month and can be applied for at any time. In the ${NON_EXPANSION_STATES.length} states that have not expanded, adults below 100% of the poverty line generally get neither Medicaid nor Marketplace credits.` },
]

const ROWS: { label: string; cobra: string; marketplace: string }[] = [
  { label: 'What it is', cobra: 'Your old employer plan, kept for a limited time.', marketplace: 'A new individual plan from HealthCare.gov or your state marketplace.' },
  { label: 'What you pay', cobra: `The whole premium, up to ${Math.round(COBRA.premiumShareOfPlanCost * 100)}% of the plan's cost, with no employer share.`, marketplace: 'The plan price minus a premium tax credit, if your income qualifies. No credit above 400% of the poverty line.' },
  { label: 'Same doctors and deductible', cobra: 'Yes. Same plan, same network, and what you already paid toward this year’s deductible counts.', marketplace: 'No. A new network and a new deductible.' },
  { label: 'How long', cobra: `Up to ${COBRA.maxMonthsJobLoss} months after a job loss.`, marketplace: 'As long as you stay enrolled and pay. Choose again each open enrollment.' },
  { label: 'Deadline to choose', cobra: `${COBRA.electionDays} days from the later of coverage ending and your notice.`, marketplace: `${MARKETPLACE.specialEnrollmentDays} days after job-based coverage ends.` },
  { label: 'Coverage start', cobra: 'Back-dated to the day your coverage ended once you elect and pay.', marketplace: 'First day of the month after you lose coverage (if you pick before) or after you pick (if you pick after).' },
  { label: 'Who can use it', cobra: 'Employers with 20 or more employees. Smaller employers may fall under a state law.', marketplace: 'Almost anyone. Credits depend on income and household size.' },
  { label: 'Switching later', cobra: 'Move to the Marketplace at open enrollment or when COBRA ends. Cancelling early does not open a window.', marketplace: 'Change plans at open enrollment, or after a qualifying life event.' },
]

const SIZES = [1, 2, 3, 4]

export default function CobraAcaPage() {
  const choices = journeyChoices('laid-off')
    .map((s) => getPersona(s))
    .filter((p): p is NonNullable<ReturnType<typeof getPersona>> => !!p)
    .map((p) => ({ slug: p.slug, label: p.label }))
  const exp = Object.values(STATE_FACTS).filter((f) => f.medicaidExpansion).length

  return (
    <SeoPage
      trail={[{ name: 'Resources', path: '/resources' }, { name: 'COBRA vs ACA', path: '/resources/cobra-aca' }]}
      h1={pageH1('/resources/cobra-aca', 'COBRA vs ACA: health insurance after a layoff')}
      lede={
        <>
          <p>
            COBRA costs the full premium for your old plan. A Marketplace (ACA) plan costs less if your income is low enough for a credit, and the same as its price if it is not. The two choices have
            different deadlines, and the cheaper one is usually decided by your household income for the whole year.
          </p>
          <AuthorByline updated={UPDATED} className="mt-4" />
        </>
      }
      jsonLd={[
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        breadcrumbJsonLd([{ name: 'Resources', path: '/resources' }, { name: 'COBRA vs ACA', path: '/resources/cobra-aca' }]),
      ]}
    >
      <section aria-labelledby="short" className="mt-8">
        <h2 id="short" className={H2}>The short answer</h2>
        <ul className="mt-4 max-w-3xl list-disc space-y-2 pl-5 text-base text-navy">
          <li>Income decides it. If your household income for the year is no more than 400% of the federal poverty line ({money(fplAmount(2026, 1) * 4)} for one person in 2026, {money(fplAmount(2026, 4) * 4)} for a family of four), you can get a premium tax credit and the Marketplace plan is often cheaper than COBRA.</li>
          <li>Above that line there is no credit. A Marketplace plan then costs its full price, and COBRA, which keeps your doctors and deductible, can be the better value.</li>
          <li>Very low income: in a state that expanded Medicaid, adults up to {MEDICAID.expansionFplPercent}% of the poverty line can qualify for Medicaid. Check this first.</li>
          <li>Do not wait on the deadlines. You have {COBRA.electionDays} days to elect COBRA and {MARKETPLACE.specialEnrollmentDays} days after coverage ends to join a Marketplace plan. The two windows run at the same time.</li>
        </ul>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link href="/tools/cobra-vs-aca-calculator" className="inline-flex h-12 items-center rounded-full bg-action px-6 text-base font-semibold text-action-foreground hover:brightness-95">
            Compare my own numbers
          </Link>
          <span className="text-sm text-muted-foreground">Free, no account, nothing saved.</span>
        </div>
      </section>

      <section aria-labelledby="table" className="mt-12">
        <h2 id="table" className={H2}>COBRA and the Marketplace, side by side</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <caption className="sr-only">COBRA compared with an ACA Marketplace plan</caption>
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="w-1/5 border-b border-border py-2 pr-3 font-medium">&nbsp;</th>
                <th scope="col" className="w-2/5 border-b border-border py-2 pr-3 font-semibold text-navy">COBRA</th>
                <th scope="col" className="w-2/5 border-b border-border py-2 font-semibold text-navy">ACA Marketplace</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.label} className="align-top">
                  <th scope="row" className="border-b border-border py-3 pr-3 text-left font-medium text-navy">{r.label}</th>
                  <td className="border-b border-border py-3 pr-3 text-muted-foreground">{r.cobra}</td>
                  <td className="border-b border-border py-3 text-muted-foreground">{r.marketplace}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="who" className="mt-12">
        <h2 id="who" className={H2}>Who should pick which</h2>
        <ol className="mt-4 max-w-3xl space-y-4 text-base">
          <li>
            <p className="font-semibold text-navy">1. Is your income for the whole year very low?</p>
            <p className="mt-1 text-muted-foreground">In one of the {exp} states and DC that expanded Medicaid, an adult up to {MEDICAID.expansionFplPercent}% of the poverty line ({money(medicaidFplAmount(1) * 1.38)} a year for one person in 2026) can qualify for Medicaid. Apply first; it can cost nothing. In the {NON_EXPANSION_STATES.length} states that have not expanded, adults below 100% of the poverty line generally get neither Medicaid nor credits.</p>
          </li>
          <li>
            <p className="font-semibold text-navy">2. Is your income at or under 400% of the poverty line?</p>
            <p className="mt-1 text-muted-foreground">Then a Marketplace plan with a credit is worth pricing. At the lower end of that range the credit can cover most of the premium. Compare it with your COBRA quote in the <Link href="/tools/cobra-vs-aca-calculator" className={LINK}>calculator</Link>.</p>
          </li>
          <li>
            <p className="font-semibold text-navy">3. Is it over 400%?</p>
            <p className="mt-1 text-muted-foreground">There is no credit, so compare COBRA with the full Marketplace price. COBRA keeps your doctors and your deductible, which matters most if you are mid-treatment or have met your deductible this year.</p>
          </li>
          <li>
            <p className="font-semibold text-navy">4. Will your income change a lot this year?</p>
            <p className="mt-1 text-muted-foreground">The credit uses your income for the whole year, including pay you already earned, severance and unemployment benefits. Estimate the year, not the weeks since the layoff, and report changes when you start a new job.</p>
          </li>
          <li>
            <p className="font-semibold text-navy">5. Do you expect a new job with coverage soon?</p>
            <p className="mt-1 text-muted-foreground">Once you elect COBRA and make the first payment, coverage is back-dated to the day your job-based coverage ended, so there is no gap. A new employer plan has its own start date and waiting period; ask your new employer and your COBRA plan administrator how the two line up before you decide.</p>
          </li>
        </ol>
      </section>

      <section aria-labelledby="clock" className="mt-12">
        <h2 id="clock" className={H2}>The deadline clock</h2>
        <ul className="mt-4 max-w-3xl space-y-3 text-base">
          <li><span className="font-semibold text-navy">Day 0:</span> <span className="text-muted-foreground">your job-based coverage ends. Your employer must send a COBRA election notice.</span></li>
          <li><span className="font-semibold text-navy">Day {COBRA.electionDays}:</span> <span className="text-muted-foreground">last day to elect COBRA (counted from the later of day 0 and the date you get the notice), and last day to join a Marketplace plan outside open enrollment (counted from day 0).</span></li>
          <li><span className="font-semibold text-navy">{COBRA.firstPaymentDays} days after you elect:</span> <span className="text-muted-foreground">your first COBRA payment is due. Coverage is back-dated to day 0.</span></li>
          <li><span className="font-semibold text-navy">{MARKETPLACE.documentDays} days after you pick a Marketplace plan:</span> <span className="text-muted-foreground">last day to send proof that you lost job-based coverage.</span></li>
        </ul>
        <div className="mt-6 max-w-xl">
          <DeadlineEmailBox source="cobra_vs_aca:explainer" journeyChoices={choices} />
        </div>
      </section>

      <section aria-labelledby="numbers" className="mt-12">
        <h2 id="numbers" className={H2}>The 2026 and 2027 numbers</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          The credit for a coverage year uses the federal poverty guidelines published for the year before it, because that is what was current when open enrollment began. Above 400% of the poverty line there is no credit.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <caption className="sr-only">Income at which the premium tax credit ends, by household size</caption>
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="border-b border-border py-2 pr-3 font-medium">Household</th>
                <th scope="col" className="border-b border-border py-2 pr-3 font-medium">Poverty line, 2026 coverage ({FPL[2025].year} guidelines)</th>
                <th scope="col" className="border-b border-border py-2 pr-3 font-medium">Credit ends above</th>
                <th scope="col" className="border-b border-border py-2 pr-3 font-medium">Poverty line, 2027 coverage ({FPL[2026].year} guidelines)</th>
                <th scope="col" className="border-b border-border py-2 font-medium">Credit ends above</th>
              </tr>
            </thead>
            <tbody>
              {SIZES.map((n) => (
                <tr key={n}>
                  <th scope="row" className="border-b border-border py-2 pr-3 text-left font-medium text-navy">{n} {n === 1 ? 'person' : 'people'}</th>
                  <td className="border-b border-border py-2 pr-3 tabular-nums text-muted-foreground">{money(fplAmount(2026, n))}</td>
                  <td className="border-b border-border py-2 pr-3 tabular-nums text-muted-foreground">{money(fplAmount(2026, n) * 4)}</td>
                  <td className="border-b border-border py-2 pr-3 tabular-nums text-muted-foreground">{money(fplAmount(2027, n))}</td>
                  <td className="border-b border-border py-2 tabular-nums text-muted-foreground">{money(fplAmount(2027, n) * 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Contiguous states and DC. Alaska and Hawaii use higher guidelines; the calculator uses them.</p>

        <h3 className="mt-8 text-lg font-semibold text-navy">What the IRS expects you to pay for the benchmark plan</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <caption className="sr-only">Share of income expected for the benchmark plan, by income as a share of the poverty line</caption>
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="border-b border-border py-2 pr-3 font-medium">Income, share of the poverty line</th>
                <th scope="col" className="border-b border-border py-2 pr-3 font-medium">2026 share of income</th>
                <th scope="col" className="border-b border-border py-2 font-medium">2027 share of income</th>
              </tr>
            </thead>
            <tbody>
              {PTC[2026].bands.map((b, i) => {
                const b27 = PTC[2027].bands[i]
                const pct = (x: number) => `${(x * 100).toFixed(2).replace(/0$/, '')}%`
                const range = (a: typeof b) => (a.initial === a.final ? pct(a.initial) : `${pct(a.initial)} to ${pct(a.final)}`)
                return (
                  <tr key={b.fromFpl}>
                    <th scope="row" className="border-b border-border py-2 pr-3 text-left font-medium text-navy">{b.fromFpl === 0 ? 'Under 133%' : b.toFpl === 400 ? 'At least 300% up to 400%' : `At least ${b.fromFpl}% under ${b.toFpl}%`}</th>
                    <td className="border-b border-border py-2 pr-3 tabular-nums text-muted-foreground">{range(b)}</td>
                    <td className="border-b border-border py-2 tabular-nums text-muted-foreground">{range(b27)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 max-w-3xl text-xs text-muted-foreground">
          The credit is the benchmark plan’s price minus this share of your income. Source: IRS Rev. Proc. 2025-25 (2026) and Rev. Proc. 2026-26 (2027), section 3.01. For 2021 through 2025 Congress had removed the 400% cap; it is back in both tables. The affordability line for employer coverage is {(PTC[2026].requiredContribution * 100).toFixed(2)}% for 2026 and {(PTC[2027].requiredContribution * 100).toFixed(2)}% for 2027.
        </p>
      </section>

      <section aria-labelledby="states" className="mt-12">
        <h2 id="states" className={H2}>COBRA vs ACA in your state</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          The average second-lowest-cost silver plan for a 40-year-old costs ${NATIONAL_BENCHMARK[2026]} a month across the country in 2026 and ranges from ${Math.min(...Object.values(STATE_FACTS).map((f) => f.benchmark[2026]))} to ${Math.max(...Object.values(STATE_FACTS).map((f) => f.benchmark[2026]))} by state. Pick yours for its Medicaid status, marketplace and average premium.
        </p>
        <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {ALL_STATE_CODES.filter((c) => STATE_FACTS[c]).map((c) => (
            <li key={c}>
              <Link href={`/resources/cobra-aca/${stateSlug(c)}`} className={LINK}>{stateName(c)}</Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="faq" className="mt-12">
        <h2 id="faq" className={H2}>Questions people ask</h2>
        <dl className="mt-4 max-w-3xl space-y-5 text-sm">
          {FAQ.map((f) => (
            <div key={f.q}>
              <dt className="font-medium text-navy">{f.q}</dt>
              <dd className="mt-1 text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="next" className="mt-12 rounded-xl border border-border bg-white p-6">
        <h2 id="next" className="text-xl font-semibold tracking-tight text-navy">Health insurance is one deadline of many</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          A free Market Reality Assessment shows how the market reads your résumé and gives you a weekly plan that starts with the dates that matter. Also useful right now:{' '}
          <Link href="/unemployment-benefits" className={LINK}>unemployment benefits by state</Link>, <Link href="/tools/severance-calculator" className={LINK}>the severance calculator</Link> and <Link href="/tools/layoff-deadlines" className={LINK}>layoff deadlines</Link>.
        </p>
        <div className="mt-4">
          <LaidOffStart placement="explainer" />
        </div>
      </section>

      <section aria-labelledby="pdf" className="mt-12 max-w-2xl">
        <h2 id="pdf" className="text-lg font-semibold text-navy">Optional: the one-page checklist</h2>
        <p className="mt-1 text-sm text-muted-foreground">A printable version of the deadlines and the questions to ask your plan administrator.</p>
        <div className="mt-3">
          <GuideEmailGate slug="cobra-aca" guideTitle="COBRA & marketplace coverage" />
        </div>
      </section>

      <p className="mt-10 max-w-3xl text-xs text-muted-foreground">
        This page explains how the rules work. It is not legal, tax or insurance advice, and your plan documents and your state’s rules decide your case. Smaller employers may be covered by a state continuation law instead of federal COBRA; ask your plan administrator, or your{' '}
        <a href="https://content.naic.org/state-insurance-departments" rel="noopener" className={LINK}>state insurance department</a>.
      </p>

      <SourcesList />
    </SeoPage>
  )
}
