import { ImageResponse } from 'next/og'
import { stateFromSlug } from '@/lib/seo/states'
import { territoryFromSlug } from '@/lib/seo/college-bar'
import { areaName, getCollegePage } from '@/lib/seo/college-pages'

export const alt = 'College profile on NextChapter'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 86400

export default async function Image({ params }: { params: Promise<{ state: string; college: string }> }) {
  const { state, college } = await params
  const code = stateFromSlug(state) ?? territoryFromSlug(state)
  const c = code ? await getCollegePage(code, college).catch(() => null) : null
  const facts = c
    ? [c.enrollment ? `${c.enrollment.toLocaleString('en-US')} students` : '', c.completionRate != null ? `${Math.round(c.completionRate * 100)}% complete` : '', c.market?.jobsOpen ? `${c.market.jobsOpen.toLocaleString('en-US')} open jobs nearby` : ''].filter(Boolean)
    : []
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: '#ffffff', fontFamily: 'sans-serif', padding: '0 80px' }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: '#0b2545' }}>NextChapter</div>
        <div style={{ fontSize: 64, fontWeight: 700, color: '#0b2545', marginTop: 24, lineHeight: 1.1 }}>{c?.name ?? 'College profile'}</div>
        <div style={{ fontSize: 30, color: '#4a5568', marginTop: 20 }}>{[c?.city, code ? areaName(code) : ''].filter(Boolean).join(', ')}</div>
        {facts.length > 0 && <div style={{ fontSize: 32, color: '#0b2545', marginTop: 40 }}>{facts.join('  ·  ')}</div>}
      </div>
    ),
    size,
  )
}
