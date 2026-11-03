import type { Metadata } from 'next'
import Link from 'next/link'
import { Section, TopicShell } from '@/components/topics/blocks'
import { canonical } from '@/lib/seo/canonical'
import { SEGMENTS } from '@/lib/segments/defs'
import { segmentPath, AMERICA_NOTE } from '@/lib/segments/cuts'
import { readSegmentIndex } from '@/lib/segments/store'
import { count, usdK } from '@/lib/segments/aggregate'
import { titleMeta } from '@/lib/seo/title'

export const revalidate = 21600
export const metadata: Metadata = {
  title: titleMeta('Jobs by industry: who is hiring and what it pays'),
  description: 'Open jobs in healthcare, finance, defense, data centers, construction, retail, hospitality, sports, media and more: the employers hiring most, the best-paying roles and the skills they ask for.',
  ...canonical('/jobs/industry'),
}

export default async function SegmentsHub() {
  const index = new Map((await readSegmentIndex().catch(() => [])).map((x) => [x.slug, x]))
  const live = SEGMENTS.filter((s) => index.get(s.slug)?.editions.length)
  const soon = SEGMENTS.filter((s) => !index.get(s.slug)?.editions.length)
  return (
    <TopicShell
      trail={[{ name: 'Jobs', path: '/jobs' }, { name: 'Jobs by industry', path: '/jobs/industry' }]}
      title="Jobs by industry: who is hiring and what it pays"
      intro={`Pick an industry to see the employers with the most openings, the highest-paying roles, the skills they ask for and the newest jobs. ${AMERICA_NOTE}`}
      capture={{ kind: 'industry', slug: 'jobs-by-industry', label: 'your industry', save: { q: '', loc: '' } }}
    >
      <Section id="all" title="Choose an industry" note="Lists are rebuilt weekly and kept by month.">
        {live.length === 0 ? (
          <p className="text-sm text-muted-foreground">These lists are being built. <Link href="/jobs" className="text-brand underline underline-offset-4">Search all jobs</Link> in the meantime.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((s) => {
              const x = index.get(s.slug)!
              return (
                <li key={s.slug}>
                  <Link href={segmentPath(s.slug)} className="block h-full rounded-xl border border-border bg-white p-4 hover:border-brand">
                    <span className="font-semibold text-navy">{s.name}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{s.blurb}</span>
                    <span className="mt-2 block text-sm tabular-nums text-navy">{count(x.total)} open jobs{x.payMed ? ` · median pay ${usdK(x.payMed)}` : ''}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Section>
      {soon.length > 0 && (
        <Section id="soon" title="Coming soon" note="Not enough verified openings yet to rank honestly. We check every week and publish a list once there are enough." tone={1}>
          <ul className="flex flex-wrap gap-2">
            {soon.map((s) => (
              <li key={s.slug}><Link href={segmentPath(s.slug)} className="inline-flex rounded-full border border-border bg-white px-3 py-1.5 text-sm text-navy hover:border-brand">{s.name}</Link></li>
            ))}
          </ul>
        </Section>
      )}
    </TopicShell>
  )
}
