import { NextResponse, type NextRequest } from 'next/server'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { sendGoalReminders } from '@/lib/weekly/goal-reminder-cron'

// Fires Monday ~1-2 hours ahead of the 12:01pm PT lock (see vercel.json).
// Final nudge — only reaches candidates who still haven't set this week's
// Search Actions before we auto-assign the suggested mix for them.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const targetMonday = getMondayOfWeek(new Date())
  const result = await sendGoalReminders(targetMonday, 'final')
  return NextResponse.json(result)
}
