import { ImageResponse } from 'next/og'
import { getSearchFirmBySlug } from '@/lib/seo/search-firm-pages'
import { FIRM_KIND_LABEL, specialties } from '@/lib/seo/search-firm-bar'

export const alt = 'Search firm on NextChapter'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 86400

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const f = await getSearchFirmBySlug(slug).catch(() => null)
  const name = f?.name ?? 'Search firm'
  const sub = f ? [FIRM_KIND_LABEL[f.kind], f.hq].filter(Boolean).join(' · ') : ''
  const line = f && f.summary.publicRoles > 0
    ? `${f.summary.publicRoles.toLocaleString('en-US')} open searches${specialties(f.summary).length ? ` · ${specialties(f.summary).slice(0, 2).join(', ')}` : ''}`
    : 'Open searches, specialties and pay'
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: '#ffffff', fontFamily: 'sans-serif', padding: '0 80px' }}>
        <div style={{ fontSize: 36, fontWeight: 700, color: '#0b2545', marginBottom: 24 }}>NextChapter</div>
        <div style={{ fontSize: 64, fontWeight: 700, color: '#0b2545', lineHeight: 1.1 }}>{name.slice(0, 70)}</div>
        {sub && <div style={{ fontSize: 30, color: '#4a5568', marginTop: 20 }}>{sub}</div>}
        <div style={{ fontSize: 34, color: '#0b2545', marginTop: 28 }}>{line}</div>
      </div>
    ),
    { ...size },
  )
}
