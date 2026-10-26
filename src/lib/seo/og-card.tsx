import { ImageResponse } from 'next/og'

export const OG_SIZE = { width: 1200, height: 630 }

/** The share card every data page uses: the page's name, then its biggest number, so the picture alone says what the page holds. */
export function ogCard(opts: { eyebrow: string; headline: string; big?: string; sub?: string; footer: string }): ImageResponse {
  const { eyebrow, headline, big, sub, footer } = opts
  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', background: '#0f2a43', color: 'white', padding: 72, fontFamily: 'sans-serif' }}>
        <div style={{ fontSize: 30, opacity: 0.8 }}>{eyebrow}</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: headline.length > 44 ? 56 : headline.length > 28 ? 68 : 84, fontWeight: 700, lineHeight: 1.05 }}>{headline}</div>
          {big && <div style={{ fontSize: 64, fontWeight: 700, color: '#8fc1ff', marginTop: 26 }}>{big}</div>}
          {sub && <div style={{ fontSize: 32, marginTop: 12, opacity: 0.85 }}>{sub}</div>}
        </div>
        <div style={{ fontSize: 26, opacity: 0.7 }}>{footer}</div>
      </div>
    ),
    OG_SIZE,
  )
}
