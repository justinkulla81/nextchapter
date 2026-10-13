import { NextResponse } from 'next/server'
import { sendDailyFeedbackDigest } from '@/lib/help/notify'
import { withCronRun } from '@/lib/cron/run'

// Once a day: candidates' in-app ideas and feedback from the last 24 hours,
// in one email (help requests and problems are emailed as they arrive).
export const GET = withCronRun('help-feedback-digest', async () => {
  const sent = await sendDailyFeedbackDigest(new Date(Date.now() - 24 * 60 * 60 * 1000))
  return NextResponse.json({ items: sent })
})
