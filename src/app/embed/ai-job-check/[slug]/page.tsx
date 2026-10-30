import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { EmbedCard } from '@/components/embed/EmbedCard'
import { checkPath, socFromSlug } from '@/lib/ai-check/slug'
import { loadExposureForSoc } from '@/lib/skills/ai-exposure-server'
import { AI_EXPOSURE_SOURCE, BAND_LABEL, exposureSentence, scorePercent } from '@/lib/skills/ai-exposure'

export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}
export const metadata: Metadata = { robots: { index: false, follow: true } }

// Embeddable widget: AI exposure for one job. /data/embed has the snippet. Needs only the cached exposure table (no extra query).
export default async function EmbedAiJobCheck({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const soc6 = socFromSlug(slug)
  const e = soc6 ? await loadExposureForSoc(soc6) : null
  if (!e) notFound()
  return (
    <EmbedCard title={`AI exposure for ${e.title}`} href={checkPath(e.title, e.soc6)} linkLabel={`See the full AI job check for ${e.title}`} note={`Source: ${AI_EXPOSURE_SOURCE.name}, ${AI_EXPOSURE_SOURCE.released}. Share of the job’s tasks that already see AI use at work; not a forecast of job loss.`}>
      <p style={{ margin: 0, fontSize: 40, fontWeight: 800, lineHeight: 1.1 }}>
        {scorePercent(e.score)} <span style={{ fontSize: 16, fontWeight: 600, color: '#5a6a80' }}>· {BAND_LABEL[e.band]}</span>
      </p>
      <p style={{ margin: '8px 0 0' }}>{exposureSentence(e)}</p>
    </EmbedCard>
  )
}
