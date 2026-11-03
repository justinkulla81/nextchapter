import type { Metadata } from 'next'
import Link from 'next/link'
import { Chips, JoinBand, Section, TopicShell } from '@/components/topics/blocks'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { titleMeta } from '@/lib/seo/title'
import { ENTRY_CATEGORIES, ENTRY_ROLES, rolesInCategory } from '@/lib/entry-roles/roles'
import { getEntryStats } from '@/lib/entry-roles/live'
import { roleLabel } from '@/lib/entry-roles/text'

// Not prerendered: the counts come from a stored row, but the page lists every role and a build should not touch the database for it.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: titleMeta('Entry-Level Jobs by Role: What Each Job Is and Needs'),
  description: `${ENTRY_ROLES.length} entry-level white-collar roles explained: sales development, account executive, customer success, finance, HR, IT and more. What each job does, the skills it takes and live openings.`,
  ...canonical('/jobs/entry-level'),
}

export default async function EntryLevelHubPage() {
  const stats = await getEntryStats()
  const counts = new Map(stats.map((s) => [s.slug, s.jobs]))
  const total = stats.reduce((sum, s) => sum + s.jobs, 0)
  const byName = [...ENTRY_ROLES].sort((a, b) => roleLabel(a).localeCompare(roleLabel(b)))
  return (
    <TopicShell
      trail={[{ name: 'Jobs', path: '/jobs' }, { name: 'Entry-level jobs', path: '/jobs/entry-level' }]}
      title="Entry-level jobs by role: what each job is, the skills and open roles"
      intro={`${ENTRY_ROLES.length} starting roles in white-collar work, from sales development representative to staff accountant to IT help desk. For each: what the job is, a typical day, the skills it uses, ${total > 0 ? `${total.toLocaleString('en-US')} openings counted from employers’ own career sites, ` : ''}and where it leads. Many accept little or no experience in the role; each page says what the open postings state.`}
      jsonLd={[{
        '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Entry-level jobs by role', url: `${SITE_URL}/jobs/entry-level`,
        mainEntity: { '@type': 'ItemList', itemListElement: byName.map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/jobs/entry-level/${r.slug}`, name: roleLabel(r) })) },
      }]}
    >
      {ENTRY_CATEGORIES.map((c) => {
        const roles = rolesInCategory(c.slug)
        return (
          <Section key={c.slug} id={c.slug} title={c.name} note={c.blurb}>
            <Chips kind="entry_hub_role" event="topic_link_clicked" items={roles.map((r) => ({ href: `/jobs/entry-level/${r.slug}`, label: r.name, detail: counts.get(r.slug) ? counts.get(r.slug)!.toLocaleString('en-US') : undefined }))} />
            <p className="mt-3 text-sm"><Link href={`/jobs/entry-level/category/${c.slug}`} className="text-brand underline underline-offset-4">What each {c.name.toLowerCase()} role does</Link></p>
          </Section>
        )
      })}
      <JoinBand source="entry-level-hub" what="which of these roles fit your background" />
    </TopicShell>
  )
}
