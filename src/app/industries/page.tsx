import type { Metadata } from 'next'
import Link from 'next/link'
import { Section, TopicShell } from '@/components/topics/blocks'
import { canonical } from '@/lib/seo/canonical'
import { INDUSTRIES } from '@/lib/seo/topics'
import { industryConferenceCounts, noticeCountsByBucket } from '@/lib/seo/topic-data'

export const revalidate = 3600

const DESCRIPTION = 'Every industry NextChapter tracks: open jobs, upcoming conferences, recent layoff notices, industry associations and the functions inside it.'
export const metadata: Metadata = { title: 'Industries: jobs, conferences and layoffs', description: DESCRIPTION, ...canonical('/industries') }

export default async function IndustriesHub() {
  const [confs, notices] = await Promise.all([industryConferenceCounts().catch(() => new Map<string, number>()), noticeCountsByBucket().catch(() => new Map<string, number>())])
  return (
    <TopicShell
      trail={[{ name: 'Industries', path: '/industries' }]}
      title="Industries: jobs, conferences and layoffs"
      intro="Pick an industry to see its open jobs, the conferences and associations that serve it, and the layoff notices filed there in the last 12 months."
    >
      <Section id="all" title={`${INDUSTRIES.length} industries`}>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INDUSTRIES.map((i) => (
            <li key={i.slug}>
              <Link href={`/industries/${i.slug}`} className="block rounded-xl border border-border bg-white p-4 hover:border-brand">
                <span className="font-semibold text-navy">{i.name}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{confs.get(i.name) ?? 0} conferences · {notices.get(i.name) ?? 0} layoff notices</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted-foreground">Looking by job type instead? <Link href="/functions" className="text-brand underline underline-offset-4">Browse functions</Link>, <Link href="/conferences" className="text-brand underline underline-offset-4">conferences</Link> or the <Link href="/layoffs" className="text-brand underline underline-offset-4">layoff tracker</Link>.</p>
      </Section>
    </TopicShell>
  )
}
