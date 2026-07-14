import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
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
          borderRadius: 6,
          fontFamily: 'sans-serif',
          fontWeight: 900,
          fontSize: 27,
          color: '#0b2545',
          letterSpacing: -2,
        }}
      >
        NC
      </div>
    ),
    { ...size }
  )
}
