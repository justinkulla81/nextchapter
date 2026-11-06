import { NextResponse, type NextRequest } from 'next/server'
import { after } from 'next/server'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'
import { runPostUploadAnalysis } from '@/lib/resume/post-upload-analysis'

// The post-upload résumé analysis in its own invocation (src/lib/resume/post-analysis-dispatch.ts). Called only by the
// server, with CRON_SECRET. It answers 202 at once and does the work after the response, so the caller never waits on it.
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const SCORE = (v: unknown) => (typeof v === 'number' ? v : null)

export async function POST(request: NextRequest) {
  if (!isBearerAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let body: { profileId?: unknown; resumeId?: unknown; previous?: Record<string, unknown> | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  if (typeof body.profileId !== 'string' || typeof body.resumeId !== 'string') {
    return NextResponse.json({ error: 'profileId and resumeId are required' }, { status: 400 })
  }
  const { profileId, resumeId } = body
  const previous = body.previous
    ? { atsScore: SCORE(body.previous.atsScore), resultsScore: SCORE(body.previous.resultsScore), experienceScore: SCORE(body.previous.experienceScore) }
    : null
  after(() =>
    runPostUploadAnalysis(profileId, resumeId, previous).catch((error) => {
      console.error('Post-upload résumé analysis failed:', error)
    })
  )
  return NextResponse.json({ accepted: true }, { status: 202 })
}
