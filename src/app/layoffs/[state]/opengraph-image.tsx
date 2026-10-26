import { ogCard, OG_SIZE } from '@/lib/seo/og-card'
import { stateFromSlug, stateName } from '@/lib/seo/states'
import { TWELVE_MONTHS_MS, getPublicNotices } from '@/lib/warn/layoff-pages'

export const alt = 'State layoff notices'
export const size = OG_SIZE
export const contentType = 'image/png'
export const revalidate = 21600

export default async function Image({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  const code = stateFromSlug(state)
  const cutoff = Date.now() - TWELVE_MONTHS_MS
  const rows = code ? (await getPublicNotices().catch(() => [])).filter((n) => n.state === code && n.noticeDate.getTime() >= cutoff) : []
  const workers = rows.reduce((s, n) => s + (n.workers ?? 0), 0)
  return ogCard({
    eyebrow: 'NextChapter · Layoff tracker',
    headline: `${code ? stateName(code) : 'State'} layoffs`,
    big: rows.length ? `${rows.length.toLocaleString('en-US')} WARN notices` : undefined,
    sub: workers ? `${workers.toLocaleString('en-US')} workers named in the last 12 months` : 'WARN notices from the state labor department',
    footer: 'launchyournextchapter.com/layoffs',
  })
}
