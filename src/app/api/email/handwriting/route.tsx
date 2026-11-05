import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import { readHandwriting } from '@/lib/email/handwriting'

// A short handwritten note as a PNG, for the margin notes in our emails. Signed links only (see lib/email/handwriting.ts).

const font = readFile(path.join(process.cwd(), 'src/app/api/email/handwriting/Caveat-Bold.ttf'))
const SIZE = 44

export async function GET(request: Request) {
  const text = readHandwriting(new URL(request.url).searchParams)
  if (!text) return new Response('Not found', { status: 404 })
  // Caveat is narrow; this width leaves room for the longest allowed note on one line.
  const width = Math.ceil(text.length * SIZE * 0.42) + 24
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', fontFamily: 'Caveat', fontSize: SIZE, color: '#1d4e89' }}>{text}</div>
    ),
    {
      width,
      height: 60,
      fonts: [{ name: 'Caveat', data: await font, weight: 700, style: 'normal' }],
      headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
    },
  )
}
