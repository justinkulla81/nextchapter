import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RankingContext } from '@/components/rankings/RankingContext'
import { Chips, JoinBand, LINK, Section, TopicShell } from '@/components/topics/blocks'
import { skillSlug } from '@/lib/rankings/awards'
import { editionLabel } from '@/lib/rankings/build-edition'
import { loadSkillPage } from '@/lib/rankings/skill-pages'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { fitDescription } from '@/lib/seo/templates'
import { titleMeta } from '@/lib/seo/title'

export const revalidate = 21600
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

const noun = (k: 'skill' | 'tool') => (k === 'tool' ? 'AI tool' : 'AI skill')

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const d = await loadSkillPage(slug)
  if (!d) return { title: 'Not found', robots: { index: false, follow: true } }
  return {
    title: titleMeta(`${d.row.name}: how often jobs ask for it, and what it pays`),
    description: fitDescription(`${d.row.name} is named in ${d.row.valueLabel} of open professional roles. Its rank among ${noun(d.kind)}s month by month, median posted pay and the open jobs that ask for it.`, 165),
    ...canonical(`/ai-skills/${slug}`),
  }
}

export default async function SkillPageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const d = await loadSkillPage(slug)
  if (!d) notFound()
  const { row, kind, list, peers } = d
  const path = `/ai-skills/${slug}`
  const label = editionLabel(list.edition)
  return (
    <TopicShell
      trail={[{ name: 'AI skills', path: '/ai-skills' }, { name: row.name, path }]}
      title={`${row.name}: how often jobs ask for it, and what it pays`}
      hero="/images/topics/function-data-and-analytics.webp"
      capture={{ kind: 'ranking', slug: `skill-${slug}`.slice(0, 70), label: kind === 'tool' ? row.name : 'AI-skill', save: { q: kind === 'tool' ? row.name : 'AI', loc: '' } }}
      intro={`${row.name} is the #${row.rank} ${noun(kind)} named in open professional roles, in ${row.valueLabel} of them as of ${label}. ${row.stats.map((s) => `${s.label}: ${s.value}`).join('. ')}.`}
      jsonLd={[{ '@context': 'https://schema.org', '@type': 'WebPage', name: `${row.name} in job postings`, url: `${SITE_URL}${path}`, about: row.name, dateModified: list.builtAt.slice(0, 10) }]}
    >
      <Section id="figures" title={`${row.name} in job postings`} note={`${label}: open professional roles on employer career sites, verified in the last week.`}>
        <dl className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          {[['Rank', `#${row.rank}`], ['Share of openings', row.valueLabel], ...row.stats.map((s) => [s.label, s.value])].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-white p-4"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-1 text-xl font-bold tabular-nums text-navy">{v}</dd></div>
          ))}
        </dl>
        <p className="mt-4 text-sm"><Link href={`/jobs?q=${encodeURIComponent(row.name)}`} className={LINK}>See open jobs that name {row.name}</Link> · <Link href={`/rankings/${list.slug}`} className={LINK}>{list.title}</Link></p>
      </Section>
      <RankingContext surface="skill" places={[{ name: row.name, keys: [row.key] }]} />
      <Section id="others" title={`Other ${noun(kind)}s employers name`}>
        <Chips kind="skill_to_skill" event="topic_link_clicked" items={peers.map((r) => ({ href: `/ai-skills/${skillSlug(r.name)}`, label: r.name, detail: r.valueLabel }))} />
      </Section>
      <JoinBand source={`skill:${slug}`} what={`how to show ${row.name} on your résumé`} />
    </TopicShell>
  )
}
