import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Chips, ConferenceList, JoinBand, Section, TopicShell, functionChip, industryChip } from '@/components/topics/blocks'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { LOOKS_LIKE_ASSOCIATION } from '@/lib/seo/topics'
import { conferencesForOrganizer, getAssociation } from '@/lib/seo/topic-data'
import { titleMeta } from '@/lib/seo/title'

export const revalidate = 3600
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

async function load(slug: string) {
  const a = await getAssociation(slug)
  if (!a) return null
  const confs = await conferencesForOrganizer(a.organizers)
  const tally = (pick: (c: (typeof confs.rows)[number]) => string[]) => {
    const m = new Map<string, number>()
    for (const c of confs.rows) for (const v of pick(c)) m.set(v, (m.get(v) ?? 0) + 1)
    return [...m].sort((x, y) => y[1] - x[1]).slice(0, 10)
  }
  return { a, confs, industries: tally((c) => c.industries), functions: tally((c) => c.functions) }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const d = await load(slug)
  if (!d) return { title: 'Organizer not found', robots: { index: false, follow: true } }
  return {
    title: titleMeta(`${d.a.name}: conferences, dates and speaking opportunities`),
    description: `${d.a.name} runs ${d.confs.total} conferences we track. Dates, costs, calls for speakers and the industries and functions they serve.`,
    ...canonical(`/associations/${slug}`),
  }
}

export default async function AssociationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const d = await load(slug)
  if (!d) notFound()
  const { a, confs, industries, functions } = d
  const path = `/associations/${slug}`
  const kind = LOOKS_LIKE_ASSOCIATION.test(a.name) ? 'association' : 'organizer'
  return (
    <TopicShell
      trail={[{ name: 'Associations', path: '/associations' }, { name: a.name, path }]}
      title={`${a.name}: conferences and speaking opportunities`}
      intro={`${a.name} is a conference ${kind}. These are the ${confs.total} events of theirs in the NextChapter catalog, with dates, costs and speaking details.`}
      jsonLd={[{ '@context': 'https://schema.org', '@type': 'Organization', name: a.name, url: `${SITE_URL}${path}` }]}
    >
      {industries.length > 0 && (
        <Section id="industries" title="Industries served">
          <Chips kind="association_to_industry" event="topic_link_clicked" items={industries.map(([n, c]) => industryChip(n, c))} />
        </Section>
      )}
      {functions.length > 0 && (
        <Section id="functions" title="Functions served">
          <Chips kind="association_to_function" event="topic_link_clicked" items={functions.map(([n, c]) => functionChip(n, c))} />
        </Section>
      )}
      <Section id="conferences" title={`${a.name} conferences`}>
        <ConferenceList rows={confs.rows} total={confs.total} upcoming={confs.upcoming} source={`association:${slug}`} />
      </Section>
      <JoinBand source={`association:${slug}`} what="the industries these events serve" />
    </TopicShell>
  )
}
