import type { Metadata } from 'next'
import Link from 'next/link'
import { Section, TopicShell } from '@/components/topics/blocks'
import { canonical } from '@/lib/seo/canonical'
import { JOB_FUNCTIONS } from '@/lib/seo/topics'
import { getCatalogIndex } from '@/lib/seo/topic-data'

export const revalidate = 3600

const DESCRIPTION = 'Every job function NextChapter tracks, from finance and engineering to marketing and legal: open jobs, conferences, associations and the industries that hire.'
export const metadata: Metadata = { title: 'Job functions: jobs, conferences and layoffs', description: DESCRIPTION, ...canonical('/functions') }

export default async function FunctionsHub() {
  const index = await getCatalogIndex().catch(() => [])
  const counts = new Map<string, number>()
  for (const c of index) for (const f of c.functions) counts.set(f, (counts.get(f) ?? 0) + 1)
  return (
    <TopicShell
      trail={[{ name: 'Functions', path: '/functions' }]}
      title="Job functions: jobs, conferences and layoffs"
      intro="Pick a function to see its open jobs, the industries hiring for it, conferences for people in the role and the employers hiring for it that have filed layoff notices."
    >
      <Section id="all" title={`${JOB_FUNCTIONS.length} functions`}>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {JOB_FUNCTIONS.map((f) => (
            <li key={f.slug}>
              <Link href={`/functions/${f.slug}`} className="block rounded-xl border border-border bg-white p-4 hover:border-brand">
                <span className="font-semibold text-navy">{f.name}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{f.blurb}</span>
                {(counts.get(f.name) ?? 0) > 0 && <span className="mt-1 block text-xs text-muted-foreground">{counts.get(f.name)} conferences</span>}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted-foreground">Looking by sector instead? <Link href="/industries" className="text-brand underline underline-offset-4">Browse industries</Link>.</p>
      </Section>
    </TopicShell>
  )
}
