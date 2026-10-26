import { fitDescription } from '@/lib/seo/templates'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { LINK, JoinBand, Chips, ConferenceList, JobList, NoticeList, Section, TopicShell, industryChip } from '@/components/topics/blocks'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { associationPath, associationSlug, functionBySlug, JOB_FUNCTIONS } from '@/lib/seo/topics'
import { conferencesForFunction, getAssociations, getFunctionNotices, getTopicJobs, type TopicJobs } from '@/lib/seo/topic-data'
import { titleMeta } from '@/lib/seo/title'

export const revalidate = 3600
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

const EMPTY_JOBS: TopicJobs = { total: 0, jobs: [], functions: [], industries: [], employers: [] }

async function load(slug: string) {
  const fn = functionBySlug(slug)
  if (!fn) return null
  const [jobs, confs, notices, associations] = await Promise.all([
    getTopicJobs({ fn: fn.name }).catch(() => EMPTY_JOBS),
    conferencesForFunction(fn.name, 24).catch(() => ({ total: 0, upcoming: 0, rows: [] })),
    getFunctionNotices(fn.name).catch(() => []),
    getAssociations().catch(() => []),
  ])
  const assocSlugs = new Set(associations.map((a) => a.slug))
  const orgCounts = new Map<string, number>()
  for (const c of confs.rows) if (c.organizer && assocSlugs.has(associationSlug(c.organizer))) orgCounts.set(c.organizer, (orgCounts.get(c.organizer) ?? 0) + 1)
  const orgs = [...orgCounts].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name]) => name)
  return { fn, jobs, confs, notices, orgs }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const d = await load(slug)
  if (!d) return { title: 'Function not found', robots: { index: false, follow: true } }
  const bits = [
    d.jobs.total ? `about ${d.jobs.total.toLocaleString()} verified open jobs` : null,
    d.confs.total ? `${d.confs.total.toLocaleString()} conferences` : null,
    d.notices.length ? `${d.notices.length.toLocaleString()} layoff notices at employers hiring for it` : null,
  ].filter(Boolean)
  return {
    title: titleMeta(`${d.fn.name} jobs, conferences and layoffs`),
    description: fitDescription(`${d.fn.blurb} ${bits.length ? `${bits.join(', ')}, ` : ''}associations and the industries that hire for it.`.replace(/\s+/g, ' ').trim(), 165),
    ...canonical(`/functions/${slug}`),
  }
}

export default async function FunctionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const d = await load(slug)
  if (!d) notFound()
  const { fn, jobs, confs, notices, orgs } = d
  const path = `/functions/${slug}`
  return (
    <TopicShell
      trail={[{ name: 'Functions', path: '/functions' }, { name: fn.name, path }]}
      title={`${fn.name} jobs, conferences and layoffs`}
      intro={`${fn.blurb} Open jobs, conferences, associations, the industries that hire for this function and the employers hiring for it that have also filed layoff notices.`}
      jsonLd={[
        {
          '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${fn.name} jobs, conferences and layoffs`, url: `${SITE_URL}${path}`,
          mainEntity: { '@type': 'ItemList', itemListElement: jobs.jobs.map((j, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/jobs/${j.id}`, name: `${j.title} at ${j.company}` })) },
        },
      ]}
    >
      <Section id="jobs" title={`Open ${fn.name} jobs`} note="Verified against the employer’s own career site within the last week.">
        <JobList jobs={jobs.jobs} total={jobs.total} source={`function:${slug}`} />
      </Section>
      {jobs.industries.length > 0 && (
        <Section id="industries" title="Industries hiring for this function">
          <Chips kind="function_to_industry" event="topic_link_clicked" items={jobs.industries.map((i) => industryChip(i.name, i.count))} />
        </Section>
      )}
      {jobs.employers.length > 0 && (
        <Section id="employers" title="Employers hiring">
          <Chips kind="function_to_employer" event="topic_link_clicked" items={jobs.employers.map((e) => ({ href: `/employers/${e.slug}`, label: e.name, detail: `${e.count.toLocaleString()} open` }))} />
        </Section>
      )}
      <p className="mt-4 text-sm"><Link href={`/top-employers/${slug}`} className={LINK}>Ranked: the employers hiring the most {fn.name.toLowerCase()} jobs</Link></p>
      <Section id="conferences" title={`${fn.name} conferences`} note="Conferences organizers tag for this function. Many events are not tagged to a function yet, so this list is a floor.">
        <ConferenceList rows={confs.rows} total={confs.total} upcoming={confs.upcoming} source={`function:${slug}`} />
      </Section>
      {orgs.length > 0 && (
        <Section id="associations" title="Associations and organizers">
          <Chips kind="function_to_association" event="topic_link_clicked" items={orgs.map((o) => ({ href: associationPath(o), label: o }))} />
        </Section>
      )}
      <Section id="layoffs" title="Layoffs at employers hiring for this function" note="WARN notices from the last 12 months at employers that also have open verified jobs in this function.">
        <NoticeList notices={notices} source={`function:${slug}`} />
      </Section>
      <Section id="more" title="Other functions">
        <Chips kind="function_to_function" event="topic_link_clicked" items={JOB_FUNCTIONS.filter((f) => f.slug !== slug).map((f) => ({ href: `/functions/${f.slug}`, label: f.name }))} />
      </Section>
      <JoinBand source={`function:${slug}`} what={`your ${fn.name.toLowerCase()} background`} />
    </TopicShell>
  )
}
