import { NextResponse, type NextRequest } from 'next/server'
import { nowInPacific } from '@/lib/weekly/pt-time'
import { sendGoalReminders } from '@/lib/weekly/goal-reminder-cron'

// Fires Sunday shortly after 12:01am PT (see vercel.json) — the goal-setting
// window has just opened for the week starting tomorrow (Monday).
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const targetMonday = nowInPacific()
  targetMonday.setUTCDate(targetMonday.getUTCDate() + 1)
  targetMonday.setUTCHours(0, 0, 0, 0)

  const result = await sendGoalReminders(targetMonday, 'open')
  return NextResponse.json(result)
}
