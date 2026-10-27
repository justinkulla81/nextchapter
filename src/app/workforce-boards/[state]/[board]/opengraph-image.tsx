import { ImageResponse } from 'next/og'
import { getOrgPage } from '@/lib/seo/org-pages'
import { stateName } from '@/lib/seo/states'
import { getOrgBrand } from '@/lib/branding/store'

export const alt = 'Workforce boards'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 86400

export default async function Image({ params }: { params: Promise<{ state: string; board: string }> }) {
  const { state, board: slug } = await params
  const p = await getOrgPage('WORKFORCE_BOARD', state, slug).catch(() => null)
  const name = p?.row.name ?? 'Workforce boards'
  const sub = p ? `${p.row.label ?? ''} · ${p.row.city ? p.row.city + ', ' : ''}${stateName(p.row.state)}` : ''
  const jobs = p ? p.blocks.jobsOpen.toLocaleString('en-US') : ''
  // In the board's own colors when we have read them, so a link shared on LinkedIn looks like the board's; otherwise NextChapter's.
  const brand = p ? (await getOrgBrand('WORKFORCE_BOARD', p.row.id))?.pair ?? null : null
  const bg = brand?.primary ?? '#ffffff'
  const ink = brand?.primaryInk ?? '#0b2545'
  const muted = brand ? ink : '#4a5568'
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: bg, padding: 72, fontFamily: 'sans-serif' }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: ink }}>NextChapter</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: name.length > 50 ? 52 : 68, fontWeight: 700, color: ink, lineHeight: 1.1 }}>{name}</div>
          <div style={{ fontSize: 30, color: muted, marginTop: 20 }}>{sub}</div>
        </div>
        <div style={{ display: 'flex', fontSize: 34, color: ink, borderTop: brand ? `8px solid ${brand.secondary}` : undefined, paddingTop: brand ? 24 : 0 }}>{jobs ? `${jobs} open professional jobs in the area it serves` : ''}</div>
      </div>
    ),
    size,
  )
}
