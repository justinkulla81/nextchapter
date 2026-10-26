import { ogCard, OG_SIZE } from '@/lib/seo/og-card'
import { stateFromSlug, stateName } from '@/lib/seo/states'
import { TWELVE_MONTHS_MS, getPublicNotices } from '@/lib/warn/layoff-pages'

export const alt = 'State jobs, layoffs and workforce help'
export const size = OG_SIZE
export const contentType = 'image/png'
export const revalidate = 86400

export default async function Image({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  const code = stateFromSlug(state)
  const cutoff = Date.now() - TWELVE_MONTHS_MS
  const n = code ? (await getPublicNotices().catch(() => [])).filter((x) => x.state === code && x.noticeDate.getTime() >= cutoff).length : 0
  return ogCard({
    eyebrow: 'NextChapter · Places',
    headline: code ? stateName(code) : 'State',
    big: 'Jobs, layoffs and workforce help',
    sub: n ? `${n.toLocaleString('en-US')} layoff notices in the last 12 months` : 'Counties, cities and local job centers',
    footer: 'launchyournextchapter.com/places',
  })
}
