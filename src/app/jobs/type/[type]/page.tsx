import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Chips, JobList, JoinBand, LINK, Section, TopicShell } from '@/components/topics/blocks'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { JOB_TYPES, getJobTypeDetail } from '@/lib/seo/job-titles'
import { usd } from '@/lib/seo/job-title-rules'
import { jobTypeSeo } from '@/lib/seo/templates'

export const revalidate = 3600
export const dynamicParams = true
export function generateStaticParams() {
  return JOB_TYPES.map((t) => ({ type: t.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }): Promise<Metadata> {
  const { type } = await params
  const d = await getJobTypeDetail(type)
  if (!d) return { title: 'Jobs not found', robots: { index: false, follow: true } }
  const seo = jobTypeSeo(d.type.name, d.type.noun, d.total)
  return { title: seo.title, description: seo.description, ...canonical(`/jobs/type/${type}`) }
}

export default async function JobTypePage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  const d = await getJobTypeDetail(type)
  if (!d) notFound()
  const path = `/jobs/type/${type}`
  const seo = jobTypeSeo(d.type.name, d.type.noun, d.total)
  return (
    <TopicShell
      trail={[{ name: 'Jobs', path: '/jobs' }, { name: d.type.name, path }]}
      title={seo.h1}
      intro={`Open ${d.type.noun} jobs for experienced professionals, taken from employers’ own career sites and checked to still be open.${d.medianPay ? ` Listings that state pay show a median of ${usd(d.medianPay)} a year.` : ''}`}
      jsonLd={[
        {
          '@context': 'https://schema.org', '@type': 'CollectionPage', name: seo.h1, url: `${SITE_URL}${path}`,
          mainEntity: { '@type': 'ItemList', itemListElement: d.jobs.map((j, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/jobs/${j.id}`, name: `${j.title} at ${j.company}` })) },
        },
      ]}
    >
      <Section id="jobs" title={`Newest ${d.type.noun} jobs`} note="Verified against the employer’s own career site within the last week.">
        <JobList jobs={d.jobs} total={d.total} source={`type:${type}`} />
        <p className="mt-3 text-sm"><Link href="/jobs" className={LINK}>Search all jobs</Link></p>
      </Section>
      {d.titles.length > 0 && (
        <Section id="titles" title={`Most common ${d.type.noun} job titles`}>
          <Chips kind="type_to_title" event="topic_link_clicked" items={d.titles.map((t) => ({ href: `/jobs/title/${t.slug}`, label: t.name, detail: t.jobs.toLocaleString('en-US') }))} />
        </Section>
      )}
      {d.states.length > 0 && (
        <Section id="states" title={`Where ${d.type.noun} jobs are listed`}>
          <Chips kind="type_to_state" event="topic_link_clicked" items={d.states.map((s) => ({ href: `/places/${s.slug}`, label: s.name, detail: s.jobs.toLocaleString('en-US') }))} />
        </Section>
      )}
      <Section id="other" title="Other job types">
        <Chips kind="type_to_type" event="topic_link_clicked" items={JOB_TYPES.filter((t) => t.slug !== type).map((t) => ({ href: `/jobs/type/${t.slug}`, label: `${t.name} jobs` }))} />
      </Section>
      <JoinBand source={`type:${type}`} what={`which ${d.type.noun} roles fit your background`} />
    </TopicShell>
  )
}
