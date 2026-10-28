import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Chips, JobList, JoinBand, LINK, Section, TopicShell } from '@/components/topics/blocks'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { getTitleDetail, hasSalaryPage } from '@/lib/seo/job-titles'
import { usd } from '@/lib/seo/job-title-rules'
import { titleJobsSeo } from '@/lib/seo/templates'
import { titleMeta } from '@/lib/seo/title'
import { SaveSearchForm } from '@/components/home/SaveSearchForm'

export const revalidate = 21600
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const d = await getTitleDetail(slug)
  if (!d) return { title: 'Jobs not found', robots: { index: false, follow: true } }
  const seo = titleJobsSeo(d.stat.name, d.stat.jobs)
  return { title: titleMeta(seo.title), description: seo.description, ...canonical(`/jobs/title/${slug}`) }
}

export default async function TitleJobsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const d = await getTitleDetail(slug)
  if (!d) {
    // A title with too few open jobs has no page; send the visitor to a search for it instead of a 404.
    if (!/^[a-z0-9-]{3,80}$/.test(slug)) notFound()
    redirect(`/jobs?q=${encodeURIComponent(slug.replace(/-/g, ' '))}`)
  }
  const { stat } = d
  const path = `/jobs/title/${slug}`
  const seo = titleJobsSeo(stat.name, stat.jobs)
  return (
    <TopicShell
      trail={[{ name: 'Jobs', path: '/jobs' }, { name: 'Jobs by title', path: '/jobs/title' }, { name: stat.name, path }]}
      title={seo.h1}
      intro={`Open ${stat.name.toLowerCase()} jobs taken from employers’ own career sites and checked to still be open.${hasSalaryPage(stat) ? ` Listings that state pay show a median of ${usd(stat.median!)} a year.` : ''}`}
      jsonLd={[
        {
          '@context': 'https://schema.org', '@type': 'CollectionPage', name: seo.h1, url: `${SITE_URL}${path}`,
          mainEntity: { '@type': 'ItemList', itemListElement: d.jobs.map((j, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/jobs/${j.id}`, name: `${j.title} at ${j.company}` })) },
        },
      ]}
    >
      <Section id="jobs" title={`Open ${stat.name.toLowerCase()} jobs`} note="Verified against the employer’s own career site within the last week.">
        <JobList jobs={d.jobs} total={stat.jobs} source={`title:${slug}`} />
        <p className="mt-3 text-sm"><Link href={`/jobs?q=${encodeURIComponent(stat.name)}`} className={LINK}>Search all {stat.name.toLowerCase()} jobs</Link></p>
      </Section>
      <div className="mt-8">
        <SaveSearchForm q={stat.name} loc="" remote={false} source="page:title" heading={`Get new ${stat.name.toLowerCase()} jobs by email`} blurb="We’ll email you when new matches are posted. No account needed." cta="Email me new jobs" />
      </div>
      {hasSalaryPage(stat) && (
        <Section id="pay" title={`${stat.name} salary`}>
          <p className="max-w-3xl text-sm text-muted-foreground">
            The middle half of {stat.name.toLowerCase()} listings that state pay run from {usd(stat.p25!)} to {usd(stat.p75!)}. <Link href={`/salaries/${slug}`} className={LINK}>See the full {stat.name.toLowerCase()} salary breakdown</Link>.
          </p>
        </Section>
      )}
      {d.states.length > 0 && (
        <Section id="states" title={`Where ${stat.name.toLowerCase()} jobs are`}>
          <Chips kind="title_to_state" event="topic_link_clicked" items={d.states.map((s) => ({ href: `/places/${s.slug}`, label: s.name, detail: s.jobs.toLocaleString('en-US') }))} />
        </Section>
      )}
      {d.employers.length > 0 && (
        <Section id="employers" title={`Employers hiring ${stat.name.toLowerCase()}s`}>
          <ul className="flex flex-wrap gap-2 text-sm">
            {d.employers.map((e) => <li key={e.name} className="rounded-full border border-border bg-white px-3 py-1.5 text-navy">{e.name} <span className="tabular-nums text-muted-foreground">{e.jobs}</span></li>)}
          </ul>
        </Section>
      )}
      {d.related.length > 0 && (
        <Section id="related" title="Related job titles">
          <Chips kind="title_to_title" event="topic_link_clicked" items={d.related.map((t) => ({ href: `/jobs/title/${t.slug}`, label: t.name, detail: t.jobs.toLocaleString('en-US') }))} />
        </Section>
      )}
      <JoinBand source={`title:${slug}`} what={`how the market reads your background for ${stat.name.toLowerCase()} roles`} />
    </TopicShell>
  )
}
