import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { EmbedCard } from '@/components/embed/EmbedCard'
import { MonthBars } from '@/components/layoffs/MonthBars'
import { LAYOFF_YEAR, getMonths, getYearNotices } from '@/lib/layoffs/monthly'
import { stateFromSlug, stateName } from '@/lib/seo/states'

export const revalidate = 3600
export const metadata: Metadata = { robots: { index: false, follow: true } }

// Embeddable widget: WARN layoffs by month for the year, nationally (`us`) or for one state. /data/embed has the snippet.
export default async function EmbedLayoffChart({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  const code = state === 'us' ? null : stateFromSlug(state)
  if (state !== 'us' && !code) notFound()
  const where = code ? stateName(code) : 'United States'
  const notices = (await getYearNotices()).filter((x) => !code || x.state === code)
  const months = await getMonths(notices)
  const workers = notices.reduce((s, x) => s + (x.workers ?? 0), 0)
  const title = `${where} layoffs by month, ${LAYOFF_YEAR}`
  return (
    <EmbedCard title={title} href={code ? `/layoffs/${state}` : '/layoffs/2026'} linkLabel={code ? `All ${where} layoff notices` : `Layoffs ${LAYOFF_YEAR}: every notice, month by month`} note="Workers named in WARN notices filed with state labor departments, by notice date. The latest month is partial.">
      <p style={{ margin: '0 0 8px' }}>
        {notices.length.toLocaleString('en-US')} notices so far in {LAYOFF_YEAR}{workers ? `, naming ${workers.toLocaleString('en-US')} workers` : ''}.
      </p>
      <MonthBars months={months} label={title} />
    </EmbedCard>
  )
}
