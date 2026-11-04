import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { sendWeeklyRoundupEmail } from '@/lib/layoffs/roundup-email'

// Monday morning: last week's layoff numbers with drafts for LinkedIn, email and a reporter, emailed to the team inbox. Nothing is posted
// or sent to anyone else; a person reads it and copies what they want (also at /support/admin/layoff-roundup).
export const GET = withCronRun('layoff-roundup', async () => {
  const sent = await sendWeeklyRoundupEmail()
  return NextResponse.json({ sent })
})
