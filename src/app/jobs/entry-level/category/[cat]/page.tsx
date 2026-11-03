import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Chips, JoinBand, LINK, Section, TopicShell } from '@/components/topics/blocks'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { fitDescription } from '@/lib/seo/templates'
import { titleMeta } from '@/lib/seo/title'
import { ENTRY_CATEGORIES, entryCategory, rolesInCategory } from '@/lib/entry-roles/roles'
import { getEntryStats } from '@/lib/entry-roles/live'
import { roleLabel } from '@/lib/entry-roles/text'

export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return ENTRY_CATEGORIES.map((c) => ({ cat: c.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ cat: string }> }): Promise<Metadata> {
  const { cat } = await params
  const c = entryCategory(cat)
  if (!c) return { title: 'Entry-level jobs', robots: { index: false, follow: true } }
  return {
    title: titleMeta(`Entry-Level ${c.name} Jobs: Roles and Skills`),
    description: fitDescription(`Entry-level ${c.name.toLowerCase()} jobs: what each role does, the skills it takes and the openings now. ${c.blurb}`, 160),
    ...canonical(`/jobs/entry-level/category/${cat}`),
  }
}

export default async function EntryCategoryPage({ params }: { params: Promise<{ cat: string }> }) {
  const { cat } = await params
  const c = entryCategory(cat)
  if (!c) {
    if (!/^[a-z0-9-]{2,60}$/.test(cat)) notFound()
    redirect('/jobs/entry-level')
  }
  const path = `/jobs/entry-level/category/${cat}`
  const roles = rolesInCategory(cat)
  const counts = new Map((await getEntryStats()).map((s) => [s.slug, s.jobs]))
  const total = roles.reduce((sum, r) => sum + (counts.get(r.slug) ?? 0), 0)
  return (
    <TopicShell
      trail={[{ name: 'Jobs', path: '/jobs' }, { name: 'Entry-level jobs', path: '/jobs/entry-level' }, { name: c.name, path }]}
      title={`Entry-level ${c.name.toLowerCase()} jobs: ${roles.length} roles explained`}
      intro={`${c.blurb} ${roles.length} starting roles in ${c.name.toLowerCase()}, with what each one does and the skills it takes${total > 0 ? `; ${total.toLocaleString('en-US')} entry-level openings are live across them now` : ''}.`}
      jsonLd={[{
        '@context': 'https://schema.org', '@type': 'CollectionPage', name: `Entry-level ${c.name.toLowerCase()} jobs`, url: `${SITE_URL}${path}`,
        mainEntity: { '@type': 'ItemList', itemListElement: roles.map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/jobs/entry-level/${r.slug}`, name: roleLabel(r) })) },
      }]}
    >
      <Section id="roles" title={`${c.name} roles`}>
        <ul className="grid gap-3 sm:grid-cols-2">
          {roles.map((r) => (
            <li key={r.slug} className="rounded-xl border border-border border-t-4 border-t-brand bg-white p-4">
              <Link href={`/jobs/entry-level/${r.slug}`} className="font-semibold text-navy hover:underline">{r.name}</Link>
              <p className="mt-0.5 text-xs text-muted-foreground">{(counts.get(r.slug) ?? 0).toLocaleString('en-US')} open now</p>
              <p className="mt-2 text-sm text-muted-foreground">{r.what}</p>
              <p className="mt-2 text-xs text-navy">Skills: {r.skills.slice(0, 4).join(', ')}</p>
            </li>
          ))}
        </ul>
      </Section>
      <Section id="other" title="Other kinds of entry-level work">
        <Chips kind="entry_category_other" event="topic_link_clicked" items={ENTRY_CATEGORIES.filter((x) => x.slug !== cat).map((x) => ({ href: `/jobs/entry-level/category/${x.slug}`, label: x.name }))} />
        <p className="mt-3 text-sm"><Link href="/jobs/entry-level" className={LINK}>All entry-level jobs</Link></p>
      </Section>
      <JoinBand source={`entry-category:${cat}`} what={`which ${c.name.toLowerCase()} roles fit your background`} />
    </TopicShell>
  )
}
