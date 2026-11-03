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
  const built = SEGMENTS.filter((s) => index.has(s.slug))
  return (
    <TopicShell
      trail={[{ name: 'Jobs', path: '/jobs' }, { name: 'Jobs by industry', path: '/jobs/industry' }]}
      title="Jobs by industry: who is hiring and what it pays"
      intro={`Pick an industry to see the employers with the most openings, the highest-paying roles, the skills they ask for and the newest jobs. ${AMERICA_NOTE}`}
      capture={{ kind: 'industry', slug: 'jobs-by-industry', label: 'your industry', save: { q: '', loc: '' } }}
    >
      <Section id="all" title="Choose an industry" note="Lists are rebuilt weekly and kept by month.">
        {built.length === 0 ? (
          <p className="text-sm text-muted-foreground">These lists are being built. <Link href="/jobs" className="text-brand underline underline-offset-4">Search all jobs</Link> in the meantime.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {built.map((s) => {
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
    </TopicShell>
  )
}
