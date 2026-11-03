import Link from 'next/link'
import type { ReactNode } from 'react'
import { JoinBand, LINK, Section, TopicShell } from '@/components/topics/blocks'
import { NewsletterSignup } from '@/components/marketing/NewsletterSignup'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { AuthorByline } from '@/components/seo/AuthorByline'
import { SITE_URL } from '@/lib/seo/facts'
import { METHOD_SHORT, citeLine, dateText } from '@/lib/pay-data/text'

export const PAY_DATA = '/resources/pay-data'

/** The cuts of the data, in the order the hub lists them. Every pay data page links to all of them. */
export const PAY_CUTS = [
  { href: `${PAY_DATA}/industry`, label: 'By industry' },
  { href: `${PAY_DATA}/function`, label: 'By function and role' },
  { href: `${PAY_DATA}/size`, label: 'By employer size' },
  { href: `${PAY_DATA}/hiring`, label: 'By hiring volume and growth' },
  { href: `${PAY_DATA}/skills`, label: 'Skills that pay more' },
] as const

export interface Faq { q: string; a: string }

/** One frame for every pay data page: header and trail, the dataset and FAQ structured data, the byline, the method, the CSV and citation, and the links to the rest. */
export function PayDataFrame({ path, trail, title, intro, asOf, datasetName, datasetDescription, faq, csv, related, children }: {
  path: string
  trail: { name: string; path: string }[]
  title: string
  intro: string
  asOf: string
  datasetName: string
  datasetDescription: string
  faq: Faq[]
  /** The CSV this page's table is in (a path under /resources/pay-data). */
  csv: string
  /** Pages specific to this one (a skill's functions, an industry's page elsewhere on the site), shown with the cuts. */
  related?: { href: string; label: string }[]
  children: ReactNode
}) {
  const url = `${SITE_URL}${path}`
  const jsonLd = [
    {
      '@context': 'https://schema.org', '@type': 'Dataset', name: datasetName, description: datasetDescription, url,
      creator: { '@type': 'Organization', name: 'NextChapter', url: SITE_URL },
      dateModified: asOf.slice(0, 10), spatialCoverage: 'United States',
      measurementTechnique: 'Employer-advertised pay ranges on live U.S. professional job postings, annualized; like-for-like gaps compare postings inside cells of the same function, level and industry.',
      variableMeasured: ['Median advertised pay', 'Lower and upper quartile of advertised pay', 'Like-for-like pay gap', 'Postings counted', 'Employers counted'],
      distribution: [{ '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${SITE_URL}${csv}` }],
    },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  ]
  return (
    <TopicShell trail={trail} title={title} intro={intro} jsonLd={jsonLd}>
      <AuthorByline updated={asOf.slice(0, 10)} className="-mt-4 mb-6" />
      {children}
      <Section id="faq" title="Questions about this data">
        <dl className="max-w-3xl space-y-5">
          {faq.map((f) => (
            <div key={f.q}>
              <dt className="font-semibold text-navy">{f.q}</dt>
              <dd className="mt-1 text-base leading-relaxed text-navy">{f.a}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section id="method" title="Method, download and how to cite" note={`Data as of ${dateText(asOf)}. Rebuilt daily.`}>
        <div className="max-w-3xl space-y-3 text-base leading-relaxed text-navy">
          <p>{METHOD_SHORT}</p>
          <p>
            A “gap, job mix matched” compares postings inside cells of the same function, level and industry, so a group is not credited for simply holding more senior or better-paid roles. It needs 150 or more postings across at least 5 cells with 15 postings on each side, and is
            shown as n/a otherwise. A gap is a difference in advertised pay between postings. It does not show that a skill, an industry or an employer size causes higher pay.
          </p>
          <p>
            <TrackedLink href={csv} event="pay_data_csv_downloaded" properties={{ page: path, csv }} className={LINK}>Download the CSV</TrackedLink> (aggregates only; no posting, employer or person is in it). Cite as: <span className="text-muted-foreground">{citeLine(datasetName, asOf, url)}</span>
          </p>
          <p>See also the <Link href="/resources/ai-skills-pay-premium" className={LINK}>AI skills salary premium</Link>, which uses the same method for AI skills only, and the <Link href="/salaries" className={LINK}>salary by job title</Link> pages.</p>
        </div>
      </Section>
      <Section id="more" title="More pay data">
        <ul className="flex flex-wrap gap-2">
          {[{ href: PAY_DATA, label: 'Pay data overview' }, ...PAY_CUTS, ...(related ?? [])].map((c) => (
            <li key={c.href}>
              <Link href={c.href} className="inline-block rounded-full border border-border bg-white px-4 py-2 text-sm text-navy hover:border-brand">{c.label}</Link>
            </li>
          ))}
        </ul>
      </Section>
      <div className="mt-10"><NewsletterSignup source="pay-data" /></div>
      <JoinBand source="pay_data" what="what you are worth" />
    </TopicShell>
  )
}

/** Shown when the first daily run has not stored the figures yet (a fresh deploy). */
export function PayDataPending({ path, title }: { path: string; title: string }) {
  return (
    <TopicShell trail={[{ name: 'Pay data', path: PAY_DATA }, { name: title, path }]} title={title} intro="The first figures publish with the next daily run. Check back tomorrow, or see salary by job title in the meantime.">
      <Section id="soon" title="Not built yet">
        <p className="text-base text-navy">
          <Link href="/salaries" className={LINK}>Salary by job title</Link> is live now.
        </p>
      </Section>
    </TopicShell>
  )
}
