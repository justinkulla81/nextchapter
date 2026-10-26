import { ogCard, OG_SIZE } from '@/lib/seo/og-card'
import { getJobStats, getTopicJobs } from '@/lib/seo/topic-data'
import { functionBySlug } from '@/lib/seo/topics'

export const alt = 'Function jobs, conferences and layoffs'
export const size = OG_SIZE
export const contentType = 'image/png'
export const revalidate = 86400

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const fn = functionBySlug(slug)
  const jobs = fn ? await getTopicJobs({ fn: fn.name }).catch(() => null) : null
  const stats = fn ? await getJobStats({ fn: fn.name }) : null
  return ogCard({
    eyebrow: 'NextChapter · Function snapshot',
    headline: `${fn?.name ?? 'Function'} jobs`,
    big: jobs?.total ? `${jobs.total.toLocaleString('en-US')} open jobs` : undefined,
    sub: stats?.p50 ? `Typical posted salary $${stats.p50.toLocaleString('en-US')} a year` : 'Jobs, conferences and layoffs',
    footer: 'launchyournextchapter.com/functions',
  })
}
