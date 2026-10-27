import type { Metadata } from 'next'
import { Chips, Section, TopicShell, JoinBand } from '@/components/topics/blocks'
import { EmployerRankTable } from '@/components/topics/EmployerRankTable'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { JOB_FUNCTIONS } from '@/lib/seo/topics'
import { getEmployerRankings, getFunctionRankings, SHARE_MIN_ROLES } from '@/lib/seo/employer-rankings'
import { titleMeta } from '@/lib/seo/title'
import { fitDescription } from '@/lib/seo/templates'

// Not prerendered: the rankings scan every open job, and a build runs seven workers at once, which timed out the
// 2026-10-27 deploy. The data is cached for a day (employer-rankings.ts) and the CDN keeps each page (next.config.ts headers).
export const dynamic = 'force-dynamic'

const TITLE = 'Top employers: entry-level hiring, no experience needed and AI hiring'
const DESCRIPTION =
  'Which employers have the most open entry-level jobs, the most jobs that need no experience, and the highest share of AI jobs, plus the biggest hirers in each function. Counted daily from verified open jobs.'
export const metadata: Metadata = { title: titleMeta(TITLE), description: fitDescription(DESCRIPTION), ...canonical('/top-employers') }

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export default async function TopEmployersPage() {
  const [r, fns] = await Promise.all([getEmployerRankings(), getFunctionRankings().catch(() => [])])
  const entryPct = r.totalOpen ? Math.round((r.totalEntry / r.totalOpen) * 100) : 0
  return (
    <TopicShell
      trail={[{ name: 'Top employers', path: '/top-employers' }]}
      title="Top employers: entry-level, no experience needed, AI"
      intro={`Counted from ${r.totalOpen.toLocaleString()} verified open jobs on ${day(r.asOf)}; ${r.totalEntry.toLocaleString()} (${entryPct}%) are entry-level or early-career. Lists cover jobs employers show publicly by name, leave out staffing and search firms that post for other employers, and update daily.`}
      jsonLd={[
        {
          '@context': 'https://schema.org', '@type': 'CollectionPage', name: TITLE, url: `${SITE_URL}/top-employers`, dateModified: r.asOf,
          mainEntity: { '@type': 'ItemList', itemListElement: r.entry.map((e, i) => ({ '@type': 'ListItem', position: i + 1, name: e.name, ...(e.slug ? { url: `${SITE_URL}/employers/${e.slug}` } : {}) })) },
        },
      ]}
    >
      <Section id="entry" title="Employers hiring the most entry-level jobs" note="Open jobs at entry or early-career level (roughly 0 to 3 years), ranked by count. The level comes from the job title, the employer and the full posting.">
        <EmployerRankTable rows={r.entry} cols={['entry', 'open']} list="entry_level" />
      </Section>
      <Section id="no-experience" title="Employers with the most jobs that need no experience" note="Entry-level jobs whose posting says people without experience are welcome, in its own words (for example “no experience required” or “we will train you”). This is a narrower list than the one above: most entry-level jobs still ask for some experience.">
        <EmployerRankTable rows={r.noExp} cols={['noExp', 'training', 'entry']} list="no_experience" />
      </Section>
      <Section id="ai-hiring" title="Employers most focused on AI jobs" note={`Open jobs that ask for a specific AI skill, such as building with models, applying AI tools at work or leading AI work. Ranked by the share of the employer’s open jobs that ask for one, among employers with ${SHARE_MIN_ROLES}+ open jobs, so a small employer with one AI job does not rank first.`}>
        <EmployerRankTable rows={r.aiShare} cols={['aiShare', 'aiSkill', 'open']} list="ai_share" />
        <h3 className="mt-8 text-lg font-semibold text-navy">Most open jobs that ask for AI skills</h3>
        <div className="mt-3">
          <EmployerRankTable rows={r.aiCount} cols={['aiSkill', 'aiShare', 'open']} list="ai_count" />
        </div>
      </Section>
      {fns.length > 0 && (
        <Section id="functions" title="Employers hiring the most, by function" note="Pick a function for the employers with the most open jobs in it.">
          <Chips kind="top_employers_to_function" event="topic_link_clicked" items={fns.map((f) => ({ href: `/top-employers/${JOB_FUNCTIONS.find((j) => j.name === f.function)!.slug}`, label: f.function, detail: f.open.toLocaleString() }))} />
        </Section>
      )}
      <JoinBand source="top-employers" what="your background" />
    </TopicShell>
  )
}
