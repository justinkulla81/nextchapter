import { NextRequest, NextResponse } from 'next/server'
import { sendTodaysApprovedMeetingPreps } from '@/lib/crm/meeting-prep/deliver'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!isBearerAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await sendTodaysApprovedMeetingPreps()
  // Vercel only logs the request line; the result is what tells a quiet night from a failure.
  console.log('meeting-prep-send', JSON.stringify(result))
  return NextResponse.json(result)
}
