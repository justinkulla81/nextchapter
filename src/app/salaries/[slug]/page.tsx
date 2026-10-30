import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Chips, JobList, JoinBand, LINK, Section, TopicShell } from '@/components/topics/blocks'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { getTitleDetail, hasSalaryPage } from '@/lib/seo/job-titles'
import { usd } from '@/lib/seo/job-title-rules'
import { salarySeo } from '@/lib/seo/templates'
import { titleMeta } from '@/lib/seo/title'
import { SaveSearchForm } from '@/components/home/SaveSearchForm'
import { ShareBar } from '@/components/marketing/ShareBar'
import { AiPremiumSection } from '@/components/salaries/AiPremiumSection'

export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const d = await getTitleDetail(slug)
  if (!d || !hasSalaryPage(d.stat)) return { title: 'Salary not found', robots: { index: false, follow: true } }
  const seo = salarySeo(d.stat.name, d.stat.median, d.stat.payCount)
  return { title: titleMeta(seo.title), description: seo.description, ...canonical(`/salaries/${slug}`) }
}

export default async function SalaryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const d = await getTitleDetail(slug)
  if (!d || !hasSalaryPage(d.stat)) {
    if (!/^[a-z0-9-]{3,80}$/.test(slug)) notFound()
    redirect(d ? `/jobs/title/${slug}` : `/jobs?q=${encodeURIComponent(slug.replace(/-/g, ' '))}`)
  }
  const { stat } = d
  const path = `/salaries/${slug}`
  const seo = salarySeo(stat.name, stat.median, stat.payCount)
  const byPay = d.states.filter((s) => s.median != null).sort((a, b) => (b.median ?? 0) - (a.median ?? 0))
  const faq = [
    { q: `How much does a ${stat.name.toLowerCase()} make?`, a: `Among ${stat.payCount.toLocaleString('en-US')} open ${stat.name.toLowerCase()} listings that state pay, the median is ${usd(stat.median!)} a year, and half of listings fall between ${usd(stat.p25!)} and ${usd(stat.p75!)}.` },
    { q: `Where does this ${stat.name.toLowerCase()} pay data come from?`, a: 'From current job listings on employers’ own career sites that state a pay range. Hourly pay is converted at 2,080 hours a year, and a listing’s midpoint is used. Listed pay is what employers advertise, not what people are paid.' },
    ...(byPay[0] ? [{ q: `Which state pays ${stat.name.toLowerCase()}s the most?`, a: `Of the states with enough listings, ${byPay[0].name} has the highest median listed pay at ${usd(byPay[0].median!)}.` }] : []),
  ]
  return (
    <TopicShell
      trail={[{ name: 'Salaries', path: '/salaries' }, { name: stat.name, path }]}
      title={seo.h1}
      intro={`${stat.name} listings that state pay run from ${usd(stat.p25!)} to ${usd(stat.p75!)} for the middle half, based on ${stat.payCount.toLocaleString('en-US')} current job listings. ${stat.jobs.toLocaleString('en-US')} ${stat.name.toLowerCase()} roles are open now.`}
      jsonLd={[
        {
          '@context': 'https://schema.org', '@type': 'Occupation', name: stat.name, url: `${SITE_URL}${path}`,
          occupationLocation: { '@type': 'Country', name: 'United States' },
          estimatedSalary: [{ '@type': 'MonetaryAmountDistribution', name: 'base', currency: 'USD', duration: 'P1Y', percentile25: stat.p25, median: stat.median, percentile75: stat.p75 }],
        },
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
      ]}
    >
      <Section id="range" title={`${stat.name} pay range`} note={`From ${stat.payCount.toLocaleString('en-US')} open listings that state pay. Annual, in US dollars.`}>
        <dl className="grid max-w-2xl grid-cols-3 gap-4 text-center">
          {[['Lower quarter', stat.p25!], ['Median', stat.median!], ['Upper quarter', stat.p75!]].map(([label, v]) => (
            <div key={label as string} className="rounded-xl border border-border bg-white p-5">
              <dt className="text-xs text-muted-foreground">{label as string}</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-navy">{usd(v as number)}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <AiPremiumSection title={stat.name} slug={slug} fn={stat.fn} />
      {byPay.length > 1 && (
        <Section id="states" title={`${stat.name} salary by state`} note="States with at least 8 listings that state pay.">
          <Chips kind="salary_to_state" event="topic_link_clicked" items={byPay.map((s) => ({ href: `/places/${s.slug}`, label: s.name, detail: usd(s.median!) }))} />
        </Section>
      )}
      <Section id="jobs" title={`Open ${stat.name.toLowerCase()} jobs`} note="Verified against the employer’s own career site within the last week.">
        <JobList jobs={d.jobs} total={stat.jobs} source={`salary:${slug}`} allHref={`/jobs/title/${slug}`} />
        <p className="mt-3 text-sm"><Link href={`/jobs/title/${slug}`} className={LINK}>All {stat.jobs.toLocaleString('en-US')} {stat.name.toLowerCase()} jobs</Link></p>
      </Section>
      <div className="mt-8">
        <ShareBar url={`${SITE_URL}/salaries/${slug}`} title={`${stat.name} salary: what the jobs pay`} placement="salary_page" label="Send this to a friend" />
      </div>
      <div className="mt-8">
        <SaveSearchForm q={stat.name} loc="" remote={false} source="page:salary" heading={`Get ${stat.name.toLowerCase()} jobs that pay like this`} blurb="We’ll email you new openings for this title. No account needed." cta="Email me new jobs" />
      </div>
      {d.related.length > 0 && (
        <Section id="related" title="Related salaries">
          <Chips kind="salary_to_salary" event="topic_link_clicked" items={d.related.filter(hasSalaryPage).map((t) => ({ href: `/salaries/${t.slug}`, label: t.name, detail: usd(t.median!) }))} />
        </Section>
      )}
      <Section id="faq" title={`${stat.name} salary questions`}>
        <dl className="max-w-3xl space-y-4 text-sm">
          {faq.map((f) => <div key={f.q}><dt className="font-medium text-navy">{f.q}</dt><dd className="mt-1 text-muted-foreground">{f.a}</dd></div>)}
        </dl>
      </Section>
      <JoinBand source={`salary:${slug}`} what={`what you are worth as a ${stat.name.toLowerCase()}`} />
    </TopicShell>
  )
}
