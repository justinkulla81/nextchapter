import { NextRequest, NextResponse } from 'next/server'
import { sendDailyFeedbackDigest } from '@/lib/help/notify'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'

// Once a day: candidates' in-app ideas and feedback from the last 24 hours,
// in one email (help requests and problems are emailed as they arrive).
export async function GET(request: NextRequest) {
  if (!isBearerAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const sent = await sendDailyFeedbackDigest(new Date(Date.now() - 24 * 60 * 60 * 1000))
  return NextResponse.json({ items: sent })
}
