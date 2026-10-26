import { ImageResponse } from 'next/og'
import { getEmployerBySlug } from '@/lib/seo/employer-pages'

// The share card for an employer page (Instagram, TikTok bios, LinkedIn, X, iMessage, Slack): name, open roles, pay.
export const alt = 'Employer hiring snapshot'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 86400

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const e = await getEmployerBySlug(slug).catch(() => null)
  const name = e?.name ?? 'Employer'
  const open = e?.profile?.openNow ?? 0
  const sub = open > 0 ? `${open.toLocaleString('en-US')} open professional roles` : 'Hiring snapshot'
  const line = e?.profile?.opened90d ? `${e.profile.opened90d.toLocaleString('en-US')} opened in the last 90 days` : 'Open roles, posted pay and where it hires'
  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', background: '#0f2a43', color: 'white', padding: 72 }}>
        <div style={{ fontSize: 30, opacity: 0.8 }}>NextChapter · Employer hiring snapshot</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: name.length > 28 ? 64 : 84, fontWeight: 700, lineHeight: 1.05 }}>{name}</div>
          <div style={{ fontSize: 44, marginTop: 28 }}>{sub}</div>
          <div style={{ fontSize: 30, marginTop: 12, opacity: 0.8 }}>{line}</div>
        </div>
        <div style={{ fontSize: 26, opacity: 0.7 }}>launchyournextchapter.com/employers</div>
      </div>
    ),
    size,
  )
}
