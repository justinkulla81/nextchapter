import { ogCard, OG_SIZE } from '@/lib/seo/og-card'
import { getCatalogIndex } from '@/lib/seo/topic-data'

export const alt = 'Conference dates, cost and speaking'
export const size = OG_SIZE
export const contentType = 'image/png'
export const revalidate = 86400

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = (await getCatalogIndex().catch(() => [])).find((x) => x.id === slug)
  const place = c ? [c.city, c.state].filter(Boolean).join(', ') : ''
  return ogCard({
    eyebrow: `NextChapter · Conference${c?.organizer ? ` · ${c.organizer}` : ''}`,
    headline: c?.name ?? 'Conference',
    big: c?.datesConfirmed && c.startDate ? day(c.startDate) : undefined,
    sub: [place, c?.speaking === 'OPEN_CFP' ? 'Open call for speakers' : ''].filter(Boolean).join(' · ') || undefined,
    footer: 'launchyournextchapter.com/conferences',
  })
}
