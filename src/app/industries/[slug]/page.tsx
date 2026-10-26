import { fitDescription } from '@/lib/seo/templates'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { JoinBand, Chips, ConferenceList, JobList, NoticeList, Section, TopicShell, functionChip } from '@/components/topics/blocks'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { associationPath, industryBySlug, INDUSTRIES } from '@/lib/seo/topics'
import { conferencesForIndustry, getAssociations, getIndustryNotices, getTopicJobs, type TopicJobs } from '@/lib/seo/topic-data'
import { associationSlug } from '@/lib/seo/topics'

export const revalidate = 3600
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

const EMPTY_JOBS: TopicJobs = { total: 0, jobs: [], functions: [], industries: [], employers: [] }

async function load(slug: string) {
  const industry = industryBySlug(slug)
  if (!industry) return null
  const [jobs, confs, notices, associations] = await Promise.all([
    industry.rule ? getTopicJobs({ rule: industry.rule }).catch(() => EMPTY_JOBS) : Promise.resolve(EMPTY_JOBS),
    conferencesForIndustry(industry.name, 24).catch(() => ({ total: 0, upcoming: 0, rows: [] })),
    getIndustryNotices(industry.name),
    getAssociations().catch(() => []),
  ])
  const assocSlugs = new Set(associations.map((a) => a.slug))
  const orgCounts = new Map<string, number>()
  for (const c of confs.rows) if (c.organizer && assocSlugs.has(associationSlug(c.organizer))) orgCounts.set(c.organizer, (orgCounts.get(c.organizer) ?? 0) + 1)
  const orgs = [...orgCounts].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name]) => name)
  return { industry, jobs, confs, notices, orgs }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const d = await load(slug)
  if (!d) return { title: 'Industry not found', robots: { index: false, follow: true } }
  const bits = [
    d.jobs.total ? `about ${d.jobs.total.toLocaleString()} verified open jobs` : null,
    d.confs.total ? `${d.confs.total.toLocaleString()} conferences` : null,
    d.notices.length ? `${d.notices.length.toLocaleString()} recent layoff notices` : null,
  ].filter(Boolean)
  return {
    title: `${d.industry.name}: jobs, conferences and layoffs`,
    description: fitDescription(`${d.industry.blurb} ${bits.length ? `${bits.join(', ')}, ` : ''}industry associations and the job functions that make it up.`.replace(/\s+/g, ' ').trim(), 165),
    ...canonical(`/industries/${slug}`),
  }
}

export default async function IndustryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const d = await load(slug)
  if (!d) notFound()
  const { industry, jobs, confs, notices, orgs } = d
  const path = `/industries/${slug}`
  return (
    <TopicShell
      trail={[{ name: 'Industries', path: '/industries' }, { name: industry.name, path }]}
      title={`${industry.name}: jobs, conferences and layoffs`}
      intro={`${industry.blurb} Open jobs, upcoming conferences, recent layoff notices, industry associations and the functions that make up this industry, all in one place.`}
      jsonLd={[
        {
          '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${industry.name}: jobs, conferences and layoffs`, url: `${SITE_URL}${path}`,
          mainEntity: { '@type': 'ItemList', itemListElement: jobs.jobs.map((j, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/jobs/${j.id}`, name: `${j.title} at ${j.company}` })) },
        },
      ]}
    >
      {industry.rule && (
        <Section id="jobs" title={`Open ${industry.name} jobs`} note="Verified against the employer’s own career site within the last week.">
          <JobList jobs={jobs.jobs} total={jobs.total} source={`industry:${slug}`} />
        </Section>
      )}
      {jobs.functions.length > 0 && (
        <Section id="functions" title="Functions hiring in this industry">
          <Chips kind="industry_to_function" event="topic_link_clicked" items={jobs.functions.map((f) => functionChip(f.name, f.count))} />
        </Section>
      )}
      {jobs.employers.length > 0 && (
        <Section id="employers" title="Employers hiring">
          <Chips kind="industry_to_employer" event="topic_link_clicked" items={jobs.employers.map((e) => ({ href: `/employers/${e.slug}`, label: e.name, detail: `${e.count.toLocaleString()} open` }))} />
        </Section>
      )}
      <Section id="conferences" title={`${industry.name} conferences`} note="Dates, costs, calls for speakers and who runs each one.">
        <ConferenceList rows={confs.rows} total={confs.total} upcoming={confs.upcoming} source={`industry:${slug}`} />
      </Section>
      {orgs.length > 0 && (
        <Section id="associations" title="Industry associations and organizers">
          <Chips kind="industry_to_association" event="topic_link_clicked" items={orgs.map((o) => ({ href: associationPath(o), label: o }))} />
        </Section>
      )}
      <Section id="layoffs" title={`${industry.name} layoffs`} note="WARN notices filed with state labor departments. Industry comes from the filing’s own classification where it gives one.">
        <NoticeList notices={notices} source={`industry:${slug}`} />
      </Section>
      <Section id="more" title="Other industries">
        <Chips kind="industry_to_industry" event="topic_link_clicked" items={INDUSTRIES.filter((i) => i.slug !== slug).map((i) => ({ href: `/industries/${i.slug}`, label: i.name }))} />
      </Section>
      <JoinBand source={`industry:${slug}`} what={`your background in ${industry.name.toLowerCase()}`} />
    </TopicShell>
  )
}
