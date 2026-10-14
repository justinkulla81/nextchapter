import { NextResponse, type NextRequest } from 'next/server'
import { draftBoardBriefs } from '@/lib/workforce/board-brief-drafts'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'

export const maxDuration = 300

// Makes draft board briefs in the mailing queue. Never sends.
export async function GET(request: NextRequest) {
  if (!isBearerAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await draftBoardBriefs())
}
