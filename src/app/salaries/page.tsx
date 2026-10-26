import type { Metadata } from 'next'
import { Chips, JoinBand, Section, TopicShell } from '@/components/topics/blocks'
import { getTitleIndex, hasSalaryPage } from '@/lib/seo/job-titles'
import { usd } from '@/lib/seo/job-title-rules'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'

export const revalidate = 21600
export const metadata: Metadata = pageMetadata('/salaries')

export default async function SalariesPage() {
  const index = (await getTitleIndex()).filter(hasSalaryPage)
  const byName = [...index].sort((a, b) => a.name.localeCompare(b.name))
  return (
    <TopicShell
      trail={[{ name: 'Salaries', path: '/salaries' }]}
      title={pageH1('/salaries', 'Salary by job title')}
      intro="What professional jobs pay, from current listings on employers’ own career sites that state a pay range. Median and the middle half for each title, annual in US dollars."
    >
      <Section id="top" title="Most listed titles">
        <Chips kind="salaries_hub" event="topic_link_clicked" items={index.slice(0, 60).map((t) => ({ href: `/salaries/${t.slug}`, label: t.name, detail: usd(t.median!) }))} />
      </Section>
      <Section id="all" title="All titles, A to Z" note={`${byName.length.toLocaleString('en-US')} titles with enough listings that state pay.`}>
        <Chips kind="salaries_hub_all" event="topic_link_clicked" items={byName.map((t) => ({ href: `/salaries/${t.slug}`, label: t.name }))} />
      </Section>
      <JoinBand source="salaries_hub" what="what you are worth" />
    </TopicShell>
  )
}
