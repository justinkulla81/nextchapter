import { fitDescription } from '@/lib/seo/templates'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LINK, FactGrid, RankList, JoinBand, Chips, ConferenceList, JobList, NoticeList, Section, TopicShell, industryChip } from '@/components/topics/blocks'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { associationPath, JOB_FUNCTIONS } from '@/lib/seo/topics'
import { loadFunction } from '@/lib/seo/topic-load'
import { titleMeta } from '@/lib/seo/title'

export const revalidate = 3600
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const d = await loadFunction(slug)
  if (!d) return { title: 'Function not found', robots: { index: false, follow: true } }
  return {
    title: titleMeta(`${d.fn.name} jobs, conferences and layoffs`),
    description: fitDescription(d.intro, 165),
    robots: { index: d.assessment.indexable, follow: true },
    ...canonical(`/functions/${slug}`),
  }
}

export default async function FunctionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const d = await loadFunction(slug)
  if (!d) notFound()
  const { fn, jobs, stats, confs, notices, orgs, facts, intro } = d
  const path = `/functions/${slug}`
  return (
    <TopicShell
      trail={[{ name: 'Functions', path: '/functions' }, { name: fn.name, path }]}
      title={`${fn.name} jobs, conferences and layoffs`}
      intro={intro}
      jsonLd={[
        {
          '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${fn.name} jobs, conferences and layoffs`, url: `${SITE_URL}${path}`,
          mainEntity: { '@type': 'ItemList', itemListElement: jobs.jobs.map((j, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/jobs/${j.id}`, name: `${j.title} at ${j.company}` })) },
        },
      ]}
    >
      <Section id="snapshot" title={`${fn.name} market snapshot`} note="Every figure names its source and period. Estimates are labeled as estimates; AI exposure is what AI could do in principle, not a measured job loss.">
        <FactGrid facts={facts} />
        {stats && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <RankList title="Skills most often named in openings" items={stats.skills.slice(0, 8).map((x) => ({ label: x.name, detail: `${Math.round((x.count / stats.sample) * 100)}%` }))} />
            <RankList title="States with the most openings" items={stats.states.map((x) => ({ label: x.state, detail: `${Math.round((x.count / stats.sample) * 100)}%` }))} />
          </div>
        )}
      </Section>
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
      <Section id="conferences" title={`${fn.name} conferences`} note="Conferences tagged for this function, plus events with no function tag whose attendee roles point here.">
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
