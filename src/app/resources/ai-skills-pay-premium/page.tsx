import type { Metadata } from 'next'
import Link from 'next/link'
import { StructuredData } from '@/components/StructuredData'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { ShareBar } from '@/components/marketing/ShareBar'
import { NewsletterSignup } from '@/components/marketing/NewsletterSignup'
import { AuthorByline, formatContentDate } from '@/components/seo/AuthorByline'
import { SITE_URL } from '@/lib/reports'
import { pageMetadata } from '@/lib/seo/keywords'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { loadAiMarket } from '@/lib/skills/ai-market-live'
import { PREMIUM_METHOD, aiPremiumForFunction, signedPct, type FunctionAiPremium } from '@/lib/pay/ai-premium'
import { MIN_LIKE_N, MIN_PER_SIDE } from '@/lib/skills/ai-market'

export const revalidate = 3600

const PATH = '/resources/ai-skills-pay-premium'
const TITLE = 'Do AI skills increase pay? What U.S. job postings advertise'
const DESCRIPTION =
  'Job postings that ask for an AI skill advertise more pay. The gap by function, matched on level and industry, with the sample sizes, the method and a CSV you can cite.'

export const metadata: Metadata = pageMetadata(PATH)

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const k = (n: number) => `$${Math.round(Math.abs(n) / 100) / 10}k`
const BODY = 'max-w-3xl text-base leading-relaxed text-navy'

export default async function AiSkillsPayPremiumPage() {
  const live = await loadAiMarket()
  const asOfIso = live ? live.asOf.slice(0, 10) : null
  const rows = live
    ? Object.keys(live.functions)
        .map((fn) => aiPremiumForFunction(live, fn))
        .filter((p): p is FunctionAiPremium => p !== null)
        .sort((a, b) => (b.likePct ?? b.rawPct) - (a.likePct ?? a.rawPct))
    : []
  const overall = live?.overall && live.overall.nAi >= MIN_PER_SIDE && live.overall.nBase >= MIN_PER_SIDE ? live.overall : null
  const url = `${SITE_URL}${PATH}`
  const csvUrl = `${SITE_URL}${PATH}/data.csv`
  const cite = `NextChapter, “AI-skill pay premium in U.S. job postings”, data as of ${asOfIso ?? '[date]'}, ${url}`

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: 'AI-skill pay premium in U.S. job postings, by function',
      description: DESCRIPTION,
      url,
      creator: { '@type': 'Organization', name: 'NextChapter', url: SITE_URL },
      ...(asOfIso ? { dateModified: asOfIso } : {}),
      spatialCoverage: 'United States',
      variableMeasured: ['Share of postings asking for an AI skill', 'Median advertised pay, postings that ask for an AI skill', 'Median advertised pay, postings that never mention AI', 'Raw premium', 'Like-for-like premium'],
      distribution: [{ '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: csvUrl }],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Do AI skills increase pay?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: overall
              ? `Job postings that ask for a specific AI skill advertise ${signedPct(overall.rawPct)} more pay at the median than postings that never mention AI, and ${signedPct(overall.likePct ?? 0)} more after matching on function, level and industry. That compares advertised pay between postings; it does not show what people are paid or that learning a skill causes a raise.`
              : 'Postings that ask for a specific AI skill advertise more pay than postings that never mention AI. The figures publish with the next daily snapshot.',
          },
        },
        {
          '@type': 'Question',
          name: 'Is the AI pay premium the same in every job?',
          acceptedAnswer: { '@type': 'Answer', text: 'No. It differs by function and level, and in some functions there are too few paid postings to show a number. The table on this page lists only functions with at least 30 paid postings on each side.' },
        },
      ],
    },
  ]

  return (
    <div className="flex flex-1 flex-col bg-white">
      {jsonLd.map((d, i) => (
        <StructuredData key={i} data={d} />
      ))}
      <PublicSiteHeader />
      <main className="mx-auto w-full max-w-4xl px-6 py-14">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Market data{asOfIso ? ` · as of ${formatContentDate(asOfIso)}` : ''}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy text-balance sm:text-4xl">{TITLE}</h1>
        <AuthorByline updated={asOfIso ?? '2026-10-27'} className="mt-3" />

        <p className={`mt-6 ${BODY} text-lg`}>
          {overall ? (
            <>
              <strong>Mostly yes, in what employers advertise.</strong> Across {overall.nAi.toLocaleString('en-US')} paid postings that ask for a specific AI skill, the median advertised pay is {usd(overall.medAi)}. Across{' '}
              {overall.nBase.toLocaleString('en-US')} paid postings that never mention AI, it is {usd(overall.medBase)}. That is {signedPct(overall.rawPct)}, a raw gap that also reflects bigger employers and more senior roles.
              {overall.likePct !== undefined && overall.likeUsd !== undefined && overall.likeN !== undefined && overall.likeN >= MIN_LIKE_N ? (
                <> Matching postings on function, level and industry, the gap is {signedPct(overall.likePct)}, about {k(overall.likeUsd)} a year.</>
              ) : null}
            </>
          ) : (
            <>Postings that ask for a specific AI skill advertise more pay than postings that never mention AI. The numbers on this page publish with the next daily snapshot.</>
          )}
        </p>

        <section className="mt-10" aria-labelledby="is-not">
          <h2 id="is-not" className="text-xl font-bold tracking-tight text-navy">What this number is, and is not</h2>
          <ul className={`mt-3 list-disc space-y-2 pl-5 ${BODY}`}>
            <li>It is a difference in <strong>advertised</strong> pay between job postings. It is not what anyone is paid.</li>
            <li>It does not show that learning an AI skill causes a raise. Employers that ask for AI skills may also pay more for other reasons.</li>
            <li>“Like for like” compares postings within the same function, level and industry. That removes most of the effect of AI postings sitting at larger employers, and some of it may remain.</li>
            <li>A posting that mentions AI without naming a skill is in neither group.</li>
          </ul>
        </section>

        <section className="mt-10" aria-labelledby="by-function">
          <h2 id="by-function" className="text-xl font-bold tracking-tight text-navy">The premium by function</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Only functions with {MIN_PER_SIDE}+ paid postings on each side are shown, so a missing function means too little data, not no premium. Sorted by the like-for-like premium where there is one.
          </p>
          {rows.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">The first table appears with the next daily snapshot.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[720px] text-left text-sm tabular-nums">
                <caption className="sr-only">Advertised pay premium for postings that ask for an AI skill, by function</caption>
                <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Function</th>
                    <th scope="col" className="px-3 py-2 font-medium">Ask for AI</th>
                    <th scope="col" className="px-3 py-2 font-medium">Median, asks for AI</th>
                    <th scope="col" className="px-3 py-2 font-medium">Median, no AI</th>
                    <th scope="col" className="px-3 py-2 font-medium">Raw</th>
                    <th scope="col" className="px-3 py-2 font-medium">Like for like</th>
                    <th scope="col" className="px-3 py-2 font-medium">Paid postings (AI / no AI)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((p) => (
                    <tr key={p.fn}>
                      <th scope="row" className="px-3 py-2 font-medium">{p.label}</th>
                      <td className="px-3 py-2">{p.sharePct}%</td>
                      <td className="px-3 py-2">{usd(p.medAi)}</td>
                      <td className="px-3 py-2">{usd(p.medBase)}</td>
                      <td className="px-3 py-2">{signedPct(p.rawPct)}</td>
                      <td className="px-3 py-2">{p.likePct !== undefined && p.likeUsd !== undefined ? `${signedPct(p.likePct)} (about ${p.likeUsd < 0 ? '-' : ''}${k(p.likeUsd)})` : '—'}</td>
                      <td className="px-3 py-2">{p.nAi.toLocaleString('en-US')} / {p.nBase.toLocaleString('en-US')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-sm">
            Industry, state and level breakdowns, and what each function asks for most, are on{' '}
            <TrackedLink href="/ai-skills" event="ai_pay_link_clicked" properties={{ page: 'ai_pay_explainer', cta: 'ai_skills' }} className="text-brand underline underline-offset-4">AI skills in job postings</TrackedLink>.
          </p>
        </section>

        <section className="mt-10" aria-labelledby="method">
          <h2 id="method" className="text-xl font-bold tracking-tight text-navy">How we measured it</h2>
          <ul className={`mt-3 list-disc space-y-2 pl-5 ${BODY}`}>
            <li>{PREMIUM_METHOD}</li>
            <li>Only postings whose AI fields were read from a full description are used; excerpt-only postings are left out. Board-listed and estimated pay is left out too. Hourly pay is converted at 2,080 hours a year.</li>
            <li><strong>Raw</strong> is the median pay of postings that ask for an AI skill divided by the median of postings that never mention AI, minus 1.</li>
            <li><strong>Like for like</strong> compares within cells of the same function, level and industry that have {MIN_PER_SIDE}+ paid postings on both sides, and takes the median log-ratio weighted by the AI side’s count. It needs {MIN_LIKE_N}+ AI postings across cells.</li>
            <li>The numbers refresh daily from the live board. {live ? `${live.counts.fullText.toLocaleString('en-US')} live postings were read from the full text in the latest snapshot.` : ''}</li>
          </ul>
        </section>

        <section className="mt-10" aria-labelledby="others">
          <h2 id="others" className="text-xl font-bold tracking-tight text-navy">How this compares with other studies</h2>
          <p className={`mt-3 ${BODY}`}>
            Lightcast’s “Beyond the Buzz” report (July 2025), built on more than 1.3 billion postings worldwide, found that postings listing AI skills offer 28% more, about $18,000 a year, and that over half of AI-skill postings are outside IT.{' '}
            <TrackedLink href="https://lightcast.io/resources/research/beyond-the-buzz-developing-the-ai-skills-employers-actually-need" event="ai_pay_link_clicked" properties={{ page: 'ai_pay_explainer', cta: 'lightcast' }} className="text-brand underline underline-offset-4">Read Lightcast’s report</TrackedLink>.
            Ours covers only live U.S. postings on employers’ own career sites, splits them by function and shows the sample sizes. The two measure different things and should not be added together.
          </p>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-off-white p-5" aria-labelledby="cite">
          <h2 id="cite" className="text-lg font-bold tracking-tight text-navy">Cite this</h2>
          <p className="mt-2 text-sm text-muted-foreground">Free to quote and chart with credit. The table above, as a CSV of aggregates only (no posting, employer or person):</p>
          <p className="mt-2 text-sm">
            <a href={`${PATH}/data.csv`} download className="font-semibold text-brand underline underline-offset-4">Download the CSV</a>
          </p>
          <p className="mt-3 text-sm text-navy"><span className="font-medium">How to cite:</span> {cite}</p>
          <div className="mt-4">
            <ShareBar url={url} title="Do AI skills increase pay? What U.S. job postings advertise" placement="ai_pay_explainer" label="Send this to someone" />
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-border bg-white p-6" aria-labelledby="next">
          <h2 id="next" className="text-xl font-bold tracking-tight text-navy">What your own pay looks like against the listings</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Pick a job title and enter your yearly pay. You see where it sits against what employers advertise for that title, and what AI skills add for the function. No account.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <TrackedLink
              href="/tools/pay-check"
              event="ai_pay_cta_clicked"
              properties={{ page: 'ai_pay_explainer', cta: 'pay_check' }}
              className="inline-flex h-12 items-center rounded-full bg-action px-6 text-base font-semibold text-action-foreground hover:brightness-95"
            >
              Check my pay
            </TrackedLink>
            <TrackedLink
              href={MARKET_REALITY_START_HREF}
              event="ai_pay_cta_clicked"
              properties={{ page: 'ai_pay_explainer', cta: 'market_reality' }}
              className="inline-flex h-12 items-center rounded-full border border-border bg-white px-6 text-base font-semibold text-navy hover:bg-muted"
            >
              Get your Market Reality Assessment
            </TrackedLink>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Want to build the skill?{' '}
            <TrackedLink href="/ai-training" event="ai_pay_cta_clicked" properties={{ page: 'ai_pay_explainer', cta: 'ai_training' }} className="text-brand underline underline-offset-4">See AI training for your people</TrackedLink>.
          </p>
        </section>

        <section className="mt-10" aria-label="Get the next update">
          <NewsletterSignup source="ai-pay-premium" />
        </section>

        <p className="mt-10 text-sm text-muted-foreground">
          <Link href="/salaries" className="text-brand underline underline-offset-4">Salaries by job title</Link> · <Link href="/resources" className="text-brand underline underline-offset-4">Guides and tools</Link>
        </p>
      </main>
      <PublicSiteFooter page="seo" />
    </div>
  )
}
