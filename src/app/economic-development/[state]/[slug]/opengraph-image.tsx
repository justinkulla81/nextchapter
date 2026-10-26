import { ImageResponse } from 'next/og'
import { getOrgPage } from '@/lib/seo/org-pages'
import { stateName } from '@/lib/seo/states'

export const alt = 'Economic development organizations'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 86400

export default async function Image({ params }: { params: Promise<{ state: string; slug: string }> }) {
  const { state, slug } = await params
  const p = await getOrgPage('ECON_DEV', state, slug).catch(() => null)
  const name = p?.row.name ?? 'Economic development organizations'
  const sub = p ? `${p.row.label ?? ''} · ${p.row.city ? p.row.city + ', ' : ''}${stateName(p.row.state)}` : ''
  const jobs = p ? p.blocks.jobsOpen.toLocaleString('en-US') : ''
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: '#ffffff', padding: 72, fontFamily: 'sans-serif' }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: '#0b2545' }}>NextChapter</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: name.length > 50 ? 52 : 68, fontWeight: 700, color: '#0b2545', lineHeight: 1.1 }}>{name}</div>
          <div style={{ fontSize: 30, color: '#4a5568', marginTop: 20 }}>{sub}</div>
        </div>
        <div style={{ fontSize: 34, color: '#0b2545' }}>{jobs ? `${jobs} open professional jobs in the area it serves` : ''}</div>
      </div>
    ),
    size,
  )
}
