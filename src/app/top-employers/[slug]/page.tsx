import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Chips, JoinBand, Section, TopicShell } from '@/components/topics/blocks'
import { EmployerRankTable } from '@/components/topics/EmployerRankTable'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { functionBySlug, JOB_FUNCTIONS } from '@/lib/seo/topics'
import { getFunctionRanking } from '@/lib/seo/employer-rankings'
import { titleMeta } from '@/lib/seo/title'

export const revalidate = 3600
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const fn = functionBySlug(slug)
  if (!fn) return { title: 'Function not found', robots: { index: false, follow: true } }
  return {
    title: titleMeta(`Top ${fn.name} employers: who is hiring the most`),
    description: `The employers with the most open ${fn.name.toLowerCase()} jobs right now, with how many are entry-level and how many ask for AI skills. Counted daily from verified open jobs.`,
    ...canonical(`/top-employers/${slug}`),
  }
}

export default async function TopEmployersFunctionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const fn = functionBySlug(slug)
  if (!fn) notFound()
  const ranking = await getFunctionRanking(fn.name).catch(() => null)
  const path = `/top-employers/${slug}`
  return (
    <TopicShell
      trail={[{ name: 'Top employers', path: '/top-employers' }, { name: fn.name, path }]}
      title={`Top ${fn.name} employers`}
      intro={ranking ? `${ranking.open.toLocaleString()} verified open ${fn.name.toLowerCase()} jobs. These employers have the most.` : `No verified open ${fn.name.toLowerCase()} jobs to rank today.`}
      jsonLd={[
        {
          '@context': 'https://schema.org', '@type': 'CollectionPage', name: `Top ${fn.name} employers`, url: `${SITE_URL}${path}`,
          mainEntity: { '@type': 'ItemList', itemListElement: (ranking?.employers ?? []).map((e, i) => ({ '@type': 'ListItem', position: i + 1, name: e.name, ...(e.slug ? { url: `${SITE_URL}/employers/${e.slug}` } : {}) })) },
        },
      ]}
    >
      <Section id="hiring" title={`Employers with the most open ${fn.name.toLowerCase()} jobs`} note="Ranked by open jobs in this function. Entry-level counts jobs at entry or early-career level; AI counts jobs asking for a specific AI skill.">
        <EmployerRankTable rows={ranking?.employers ?? []} cols={['open', 'entry', 'aiSkill']} list={`function:${slug}`} />
      </Section>
      <Section id="more" title="Other functions">
        <Chips kind="top_employers_function_to_function" event="topic_link_clicked" items={JOB_FUNCTIONS.filter((f) => f.slug !== slug).map((f) => ({ href: `/top-employers/${f.slug}`, label: f.name }))} />
      </Section>
      <JoinBand source={`top-employers:${slug}`} what={`your ${fn.name.toLowerCase()} background`} />
    </TopicShell>
  )
}
