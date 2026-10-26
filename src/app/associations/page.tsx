import { pageMetadata } from '@/lib/seo/keywords'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Section, TopicShell } from '@/components/topics/blocks'
import { canonical } from '@/lib/seo/canonical'

import { getAssociations } from '@/lib/seo/topic-data'

export const revalidate = 3600

const DESCRIPTION = 'Industry associations and event organizers that run two or more conferences in the NextChapter catalog, with their dates, costs and calls for speakers.'
export const metadata: Metadata = pageMetadata('/associations')

export default async function AssociationsHub() {
  const list = await getAssociations().catch(() => [])
  return (
    <TopicShell
      trail={[{ name: 'Associations', path: '/associations' }]}
      title="Industry associations and conference organizers"
      intro="The associations and organizers behind the conferences we track. Each page lists everything they run, with dates, costs and speaking opportunities."
    >
      <Section id="all" title={`${list.length} organizers`}>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((a) => (
            <li key={a.slug}>
              <Link href={`/associations/${a.slug}`} className="block rounded-xl border border-border bg-white p-4 hover:border-brand">
                <span className="font-semibold text-navy">{a.name}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{a.count} conferences</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted-foreground">Organizers with a single event appear on that conference’s page. <Link href="/conferences" className="text-brand underline underline-offset-4">Browse all conferences</Link>.</p>
      </Section>
    </TopicShell>
  )
}
