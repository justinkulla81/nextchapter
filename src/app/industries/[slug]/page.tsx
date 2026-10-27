import { fitDescription } from '@/lib/seo/templates'
import { FeedLine } from '@/components/seo/FeedLine'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { FactGrid, RankList, JoinBand, Chips, ConferenceList, JobList, Section, TopicShell, functionChip } from '@/components/topics/blocks'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { associationPath, INDUSTRIES } from '@/lib/seo/topics'
import { loadIndustry } from '@/lib/seo/topic-load'
import { titleMeta } from '@/lib/seo/title'

export const revalidate = 3600
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const d = await loadIndustry(slug)
  if (!d) return { title: 'Industry not found', robots: { index: false, follow: true } }
  return {
    title: titleMeta(`${d.industry.name}: jobs, conferences and layoffs`),
    description: fitDescription(d.intro, 165),
    robots: { index: d.assessment.indexable, follow: true },
    ...canonical(`/industries/${slug}`),
  }
}

export default async function IndustryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const d = await loadIndustry(slug)
  if (!d) notFound()
  const { industry, jobs, stats, confs, orgs, facts, intro } = d
  const path = `/industries/${slug}`
  return (
    <TopicShell
      trail={[{ name: 'Industries', path: '/industries' }, { name: industry.name, path }]}
      title={`${industry.name}: jobs, conferences and layoffs`}
      intro={intro}
      jsonLd={[
        {
          '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${industry.name}: jobs, conferences and layoffs`, url: `${SITE_URL}${path}`,
          mainEntity: { '@type': 'ItemList', itemListElement: jobs.jobs.map((j, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/jobs/${j.id}`, name: `${j.title} at ${j.company}` })) },
        },
      ]}
    >
      <Section id="snapshot" title={`${industry.name} market snapshot`} note="Every figure names its source and period. Estimates are labeled as estimates.">
        <FactGrid facts={facts} />
        {stats && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <RankList title="Skills most often named in openings" items={stats.skills.slice(0, 8).map((x) => ({ label: x.name, detail: `${Math.round((x.count / stats.sample) * 100)}%` }))} />
            <RankList title="States with the most openings" items={stats.states.map((x) => ({ label: x.state, detail: `${Math.round((x.count / stats.sample) * 100)}%` }))} />
          </div>
        )}
      </Section>
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
      <Section id="feed" title={`${industry.name} layoff notices by feed`}>
        <p className="text-sm"><FeedLine feed={`/feeds/industries/${slug}`} label={`Get new ${industry.name} layoff notices by RSS`} /></p>
      </Section>
      <Section id="more" title="Other industries">
        <Chips kind="industry_to_industry" event="topic_link_clicked" items={INDUSTRIES.filter((i) => i.slug !== slug).map((i) => ({ href: `/industries/${i.slug}`, label: i.name }))} />
      </Section>
      <JoinBand source={`industry:${slug}`} what={`your background in ${industry.name.toLowerCase()}`} />
    </TopicShell>
  )
}
