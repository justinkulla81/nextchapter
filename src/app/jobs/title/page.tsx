import type { Metadata } from 'next'
import { Chips, JoinBand, Section, TopicShell } from '@/components/topics/blocks'
import { JOB_TYPES, getTitleIndex } from '@/lib/seo/job-titles'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'

export const revalidate = 21600
export const metadata: Metadata = pageMetadata('/jobs/title')

export default async function JobTitlesPage() {
  const index = await getTitleIndex()
  const byName = [...index].sort((a, b) => a.name.localeCompare(b.name))
  return (
    <TopicShell
      trail={[{ name: 'Jobs', path: '/jobs' }, { name: 'Jobs by title', path: '/jobs/title' }]}
      title={pageH1('/jobs/title', 'Jobs by title')}
      intro="Open professional jobs by job title, from employers’ own career sites and checked to still be open."
    >
      <Section id="types" title="By type of work">
        <Chips kind="titles_hub_types" event="topic_link_clicked" items={JOB_TYPES.map((t) => ({ href: `/jobs/type/${t.slug}`, label: `${t.name} jobs` }))} />
      </Section>
      <Section id="top" title="Most listed titles">
        <Chips kind="titles_hub" event="topic_link_clicked" items={index.slice(0, 60).map((t) => ({ href: `/jobs/title/${t.slug}`, label: t.name, detail: t.jobs.toLocaleString('en-US') }))} />
      </Section>
      <Section id="all" title="All titles, A to Z" note={`${byName.length.toLocaleString('en-US')} titles.`}>
        <Chips kind="titles_hub_all" event="topic_link_clicked" items={byName.map((t) => ({ href: `/jobs/title/${t.slug}`, label: t.name }))} />
      </Section>
      <JoinBand source="titles_hub" what="which of these roles fit your background" />
    </TopicShell>
  )
}
