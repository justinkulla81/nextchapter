import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
          fontFamily: 'sans-serif',
          fontWeight: 700,
          fontSize: 88,
          color: '#0b2545',
          letterSpacing: -4,
        }}
      >
        NC
      </div>
    ),
    { ...size }
  )
}
