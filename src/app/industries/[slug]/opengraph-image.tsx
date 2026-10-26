import { ogCard, OG_SIZE } from '@/lib/seo/og-card'
import { getIndustryNotices, getTopicJobs } from '@/lib/seo/topic-data'
import { industryBySlug } from '@/lib/seo/topics'

export const alt = 'Industry jobs, conferences and layoffs'
export const size = OG_SIZE
export const contentType = 'image/png'
export const revalidate = 86400

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const industry = industryBySlug(slug)
  const name = industry?.name ?? 'Industry'
  const jobs = industry?.rule ? await getTopicJobs({ rule: industry.rule }).catch(() => null) : null
  const notices = industry ? await getIndustryNotices(industry.name).catch(() => []) : []
  return ogCard({
    eyebrow: 'NextChapter · Industry snapshot',
    headline: name,
    big: jobs?.total ? `${jobs.total.toLocaleString('en-US')} open jobs` : undefined,
    sub: notices.length ? `${notices.length.toLocaleString('en-US')} layoff notices in the last 12 months` : 'Jobs, conferences and layoffs',
    footer: 'launchyournextchapter.com/industries',
  })
}
