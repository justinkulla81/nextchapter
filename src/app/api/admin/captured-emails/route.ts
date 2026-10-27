import { NextResponse, type NextRequest } from 'next/server'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'
import { loadCapturedEmails, groupByEmail } from '@/lib/leads/captured-emails'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

const DAY_MS = 24 * 60 * 60 * 1000

// Read path for the daily digest's new-leads section: every address captured
// since `since` (ISO time, default the last 24 hours), one entry per address.
// Same Bearer key as the other digest endpoints.
export async function GET(request: NextRequest) {
  if (!isBearerAuthorized(request.headers.get('authorization'), process.env.NC_ATS_API_KEY)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const raw = request.nextUrl.searchParams.get('since')
  const parsed = raw ? new Date(raw) : null
  const since = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(Date.now() - DAY_MS)

  const people = groupByEmail(await loadCapturedEmails(since))
  return NextResponse.json({ since: since.toISOString(), count: people.length, people })
}
