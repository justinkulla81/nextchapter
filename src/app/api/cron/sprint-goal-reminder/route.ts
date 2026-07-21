import { NextResponse, type NextRequest } from 'next/server'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { sendGoalReminders } from '@/lib/weekly/goal-reminder-cron'

// Fires Monday shortly after 12:01am PT (see vercel.json) — 12 hours before
// the 12:01pm PT lock. Only reaches candidates who still haven't set this
// week's Search Actions.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const targetMonday = getMondayOfWeek(new Date())
  const result = await sendGoalReminders(targetMonday, 'reminder')
  return NextResponse.json(result)
}
