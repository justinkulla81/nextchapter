import { ImageResponse } from 'next/og'
import { socFromSlug } from '@/lib/ai-check/slug'
import { loadExposureForSoc } from '@/lib/skills/ai-exposure-server'
import { BAND_LABEL, scorePercent } from '@/lib/skills/ai-exposure'
import { OG_SIZE } from '@/lib/seo/og-card'

// The picture a pasted link shows on LinkedIn, X and iMessage: the score big, the band, the job title. The score comes from
// the in-memory exposure map (one table read per six hours), so the image costs no extra query and no model call.
export const alt = 'How much of the work AI already does in this job'
export const size = OG_SIZE
export const contentType = 'image/png'
export const revalidate = 86400

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const soc6 = socFromSlug(slug)
  const e = soc6 ? await loadExposureForSoc(soc6) : null
  const title = e?.title ?? 'AI job check'
  const high = e?.band === 'high'
  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', background: '#0f2a43', color: 'white', padding: 72, fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 30, opacity: 0.85 }}>
          <div style={{ display: 'flex', width: 44, height: 44, borderRadius: 10, background: '#8fc1ff', color: '#0f2a43', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 28, marginRight: 16 }}>N</div>
          NextChapter · AI job check
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: title.length > 40 ? 52 : 64, fontWeight: 700, lineHeight: 1.08 }}>{title}</div>
          {e ? (
            <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 24 }}>
              <div style={{ fontSize: 190, fontWeight: 800, color: high ? '#ffb86b' : '#8fc1ff', lineHeight: 1 }}>{scorePercent(e.score)}</div>
              <div style={{ fontSize: 44, fontWeight: 600, marginLeft: 28 }}>{BAND_LABEL[e.band]}</div>
            </div>
          ) : null}
          <div style={{ fontSize: 32, marginTop: 18, opacity: 0.9 }}>{e ? 'of tasks already see AI use at work' : 'How much of your job does AI already do?'}</div>
        </div>
        <div style={{ fontSize: 24, opacity: 0.7 }}>Source: Anthropic Economic Index · launchyournextchapter.com/tools/ai-job-check</div>
      </div>
    ),
    OG_SIZE,
  )
}
