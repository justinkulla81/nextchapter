import { ImageResponse } from 'next/og'

export const alt = 'NextChapter — Welcome to your Next Chapter'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 40,
            fontWeight: 700,
            color: '#0b2545',
            marginBottom: 24,
          }}
        >
          NextChapter
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: '#0b2545',
            textAlign: 'center',
            padding: '0 80px',
          }}
        >
          Welcome to your Next Chapter
        </div>
        <div
          style={{
            fontSize: 28,
            color: '#4a5568',
            marginTop: 32,
            textAlign: 'center',
            padding: '0 120px',
          }}
        >
          Get your free Hireability Score and a personalized action plan
        </div>
        <div
          style={{
            width: 160,
            height: 6,
            backgroundColor: '#2e7d5b',
            marginTop: 40,
            borderRadius: 3,
          }}
        />
      </div>
    ),
    { ...size }
  )
}
