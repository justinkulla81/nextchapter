import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Chips, JobList, JoinBand, LINK, Section, TopicShell } from '@/components/topics/blocks'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { getTitlePlaceDetail } from '@/lib/seo/job-titles'
import { parsePlace } from '@/lib/seo/job-title-places'
import { usd } from '@/lib/seo/job-title-rules'
import { stateSlug } from '@/lib/seo/states'
import { titlePlaceJobsSeo } from '@/lib/seo/templates'
import { titleLabel } from '@/lib/seo/title-aliases'
import { titleMeta } from '@/lib/seo/title'
import { SaveSearchForm } from '@/components/home/SaveSearchForm'

// One title in one city or state: "<title> jobs in <place>". The figures come from the board-figures cron (job-titles.ts), never a scan on
// the request. A pair below the bar (job-title-places.ts) has no stored row, so its address redirects to the title page.
export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; place: string }> }): Promise<Metadata> {
  const { slug, place } = await params
  const d = await getTitlePlaceDetail(slug, place)
  if (!d) return { title: 'Jobs not found', robots: { index: false, follow: true } }
  const seo = titlePlaceJobsSeo(titleLabel(d.stat.name, slug), d.place.name, d.place.jobs, d.place.median)
  return { title: titleMeta(seo.title), description: seo.description, ...canonical(`/jobs/title/${slug}/${place}`) }
}

export default async function TitlePlaceJobsPage({ params }: { params: Promise<{ slug: string; place: string }> }) {
  const { slug, place } = await params
  if (!/^[a-z0-9-]{3,80}$/.test(slug) || !parsePlace(place)) notFound()
  const d = await getTitlePlaceDetail(slug, place)
  // Too few open listings here for a page of its own: the title page shows the whole market for the title.
  if (!d) redirect(`/jobs/title/${slug}`)
  const { stat, place: p, jobs } = d
  const path = `/jobs/title/${slug}/${place}`
  const seo = titlePlaceJobsSeo(titleLabel(stat.name, slug), p.name, p.jobs, p.median)
  const lower = stat.name.toLowerCase()
  return (
    <TopicShell
      trail={[{ name: 'Jobs', path: '/jobs' }, { name: 'Jobs by title', path: '/jobs/title' }, { name: stat.name, path: `/jobs/title/${slug}` }, { name: p.name, path }]}
      title={seo.h1}
      intro={`${p.jobs.toLocaleString('en-US')} open ${lower} jobs in ${p.name}, taken from employers’ own career sites and checked to still be open.${p.median ? ` Listings that state pay show a median of ${usd(p.median)} a year.` : ''}`}
      jsonLd={[
        {
          '@context': 'https://schema.org', '@type': 'CollectionPage', name: seo.h1, url: `${SITE_URL}${path}`,
          mainEntity: { '@type': 'ItemList', itemListElement: jobs.map((j, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/jobs/${j.id}`, name: `${j.title} at ${j.company}` })) },
        },
      ]}
    >
      <Section id="jobs" title={`Open ${lower} jobs in ${p.name}`} note="Verified against the employer’s own career site within the last week.">
        <JobList jobs={jobs} total={p.jobs} source={`title-place:${slug}:${place}`} />
        <p className="mt-3 text-sm">
          <Link href={`/jobs?q=${encodeURIComponent(stat.name)}&loc=${encodeURIComponent(p.name)}`} className={LINK}>Search all {lower} jobs in {p.name}</Link>
          {' · '}
          <Link href={`/jobs/title/${slug}`} className={LINK}>All {lower} jobs</Link>
        </p>
      </Section>
      <div className="mt-8">
        <SaveSearchForm q={stat.name} loc={p.name} remote={false} source="page:title-place" heading={`Get new ${lower} jobs in ${p.name} by email`} blurb="We’ll email you when new matches are posted. No account needed." cta="Email me new jobs" />
      </div>
      {p.median != null && (
        <Section id="pay" title={`${stat.name} pay in ${p.name}`}>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {p.payCount.toLocaleString('en-US')} of the {p.jobs.toLocaleString('en-US')} open listings state pay, and their median is {usd(p.median)} a year. <Link href={`/salaries/${slug}`} className={LINK}>See the national {lower} salary breakdown</Link>.
          </p>
        </Section>
      )}
      {p.employers.length > 0 && (
        <Section id="employers" title={`Employers hiring ${lower}s in ${p.name}`}>
          <ul className="flex flex-wrap gap-2 text-sm">
            {p.employers.map((e) => <li key={e.name} className="rounded-full border border-border bg-white px-3 py-1.5 text-navy">{e.name} <span className="tabular-nums text-muted-foreground">{e.jobs}</span></li>)}
          </ul>
        </Section>
      )}
      {p.nearby.length > 0 && (
        <Section id="nearby" title={`${stat.name} jobs in nearby places`}>
          <Chips kind="title_place_to_place" event="topic_link_clicked" items={p.nearby.map((n) => ({ href: `/jobs/title/${slug}/${n.key}`, label: n.name, detail: n.jobs.toLocaleString('en-US') }))} />
        </Section>
      )}
      {p.otherTitles.length > 0 && (
        <Section id="other-titles" title={`Other jobs in ${p.name}`}>
          <Chips kind="title_place_to_title" event="topic_link_clicked" items={p.otherTitles.map((t) => ({ href: `/jobs/title/${t.slug}/${place}`, label: t.name, detail: t.jobs.toLocaleString('en-US') }))} />
        </Section>
      )}
      <p className="mt-8 text-sm text-muted-foreground">
        <Link href={`/places/${stateSlug(p.state)}`} className={LINK}>Local job market in {p.kind === 'state' ? p.name : p.state}</Link>
      </p>
      <JoinBand source={`title-place:${slug}:${place}`} what={`how the market reads your background for ${lower} roles in ${p.name}`} />
    </TopicShell>
  )
}
