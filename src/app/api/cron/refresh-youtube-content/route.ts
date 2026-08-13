import { NextResponse, type NextRequest } from 'next/server'
import { refreshYouTubeVideos } from '@/lib/content/youtube-ingest'

export const maxDuration = 60

// Fires every 2 days (see vercel.json) — this content doesn't change fast
// enough to justify a daily pull, and per-page-load would burn YouTube Data
// API quota for no real benefit. No-ops cleanly if YOUTUBE_API_KEY isn't
// configured yet (see refreshYouTubeVideos).
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await refreshYouTubeVideos()
  return NextResponse.json({ ok: true })
}
