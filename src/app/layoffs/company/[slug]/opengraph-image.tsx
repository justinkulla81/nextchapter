import { ogCard, OG_SIZE } from '@/lib/seo/og-card'
import { getPublicNotices, noticeDay } from '@/lib/warn/layoff-pages'

export const alt = 'Employer layoff notices'
export const size = OG_SIZE
export const contentType = 'image/png'
export const revalidate = 21600

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const rows = (await getPublicNotices().catch(() => [])).filter((n) => n.slug === slug)
  const name = rows.map((n) => n.employer).sort((a, b) => a.length - b.length)[0] ?? 'Employer'
  const workers = rows.reduce((s, n) => s + (n.workers ?? 0), 0)
  return ogCard({
    eyebrow: 'NextChapter · Layoff tracker',
    headline: `${name} layoffs`,
    big: rows.length ? `${rows.length.toLocaleString('en-US')} WARN ${rows.length === 1 ? 'notice' : 'notices'}${workers ? `, ${workers.toLocaleString('en-US')} workers` : ''}` : undefined,
    sub: rows[0] ? `Latest filed ${noticeDay(rows[0].noticeDate)}` : undefined,
    footer: 'launchyournextchapter.com/layoffs',
  })
}
