import { NextRequest, NextResponse } from 'next/server'
import { sendDailyFeedbackDigest } from '@/lib/help/notify'

// Once a day: candidates' in-app ideas and feedback from the last 24 hours,
// in one email (help requests and problems are emailed as they arrive).
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const sent = await sendDailyFeedbackDigest(new Date(Date.now() - 24 * 60 * 60 * 1000))
  return NextResponse.json({ items: sent })
}
