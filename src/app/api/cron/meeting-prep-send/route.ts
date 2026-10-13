import { NextResponse } from 'next/server'
import { sendTodaysApprovedMeetingPreps } from '@/lib/crm/meeting-prep/deliver'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

export const GET = withCronRun('meeting-prep-send', async () => {
  const result = await sendTodaysApprovedMeetingPreps()
  // Vercel only logs the request line; the result is what tells a quiet night from a failure.
  console.log('meeting-prep-send', JSON.stringify(result))
  return NextResponse.json(result)
})
