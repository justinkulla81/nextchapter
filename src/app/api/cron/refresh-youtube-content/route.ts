import { NextResponse, type NextRequest } from 'next/server'
import { refreshYouTubeVideos } from '@/lib/content/youtube-ingest'

// 60 was enough for the original ~5 sequential keyword searches, but the
// Shorts-duration pass + 10 AI-tool topic searches (see youtube-ingest.ts)
// pushed this well past it (real 504 FUNCTION_INVOCATION_TIMEOUT observed).
// 300 is the actual ceiling on this project's plan (Hobby + Fluid Compute),
// same as dashboard/layout.tsx's report-generation path.
export const maxDuration = 300

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
