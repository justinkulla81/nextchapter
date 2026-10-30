import { ImageResponse } from 'next/og'
import { KIND_LABEL, type CardKind } from './card'

export const IMAGE_SIZES = {
  portrait: { width: 1080, height: 1350 },
  wide: { width: 1200, height: 630 },
} as const
export type ImageSize = keyof typeof IMAGE_SIZES

const PALETTE: Record<CardKind, { bg: string; accent: string }> = {
  layoff: { bg: '#0f2a43', accent: '#8fc1ff' },
  'ai-job': { bg: '#1d1b4b', accent: '#b9a8ff' },
  'ai-pay': { bg: '#0b3b32', accent: '#7ee0c0' },
  market: { bg: '#2b2540', accent: '#ffc27a' },
  deadline: { bg: '#4a1d1d', accent: '#ffb199' },
}

/** The share image for one draft: the number as big as it goes, then what it counts and the headline. */
export function renderContentCard(d: { kind: string; big: string; bigLabel: string; headline: string; source: string }, size: ImageSize): ImageResponse {
  const { width, height } = IMAGE_SIZES[size]
  const p = PALETTE[d.kind as CardKind] ?? PALETTE.layoff
  const tall = size === 'portrait'
  const bigSize = (tall ? 330 : 190) * (d.big.length > 9 ? 0.55 : d.big.length > 6 ? 0.72 : d.big.length > 4 ? 0.88 : 1)
  const pad = tall ? 88 : 64
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: pad, backgroundColor: p.bg, color: 'white', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', fontSize: tall ? 34 : 26, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: p.accent }}>
          {KIND_LABEL[d.kind as CardKind] ?? 'NextChapter'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: bigSize, fontWeight: 800, lineHeight: 1, color: p.accent }}>{d.big}</div>
          <div style={{ display: 'flex', fontSize: tall ? 46 : 30, marginTop: tall ? 20 : 8, opacity: 0.92 }}>{d.bigLabel}</div>
          <div style={{ display: 'flex', fontSize: tall ? (d.headline.length > 90 ? 50 : 62) : (d.headline.length > 90 ? 30 : 38), fontWeight: 700, lineHeight: 1.15, marginTop: tall ? 70 : 28 }}>{d.headline}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: tall ? 28 : 22, opacity: 0.8 }}>
          <div style={{ display: 'flex', maxWidth: '68%' }}>{d.source.length > 80 ? `${d.source.slice(0, 77)}…` : d.source}</div>
          <div style={{ display: 'flex', fontWeight: 700 }}>NextChapter</div>
        </div>
      </div>
    ),
    { width, height },
  )
}
