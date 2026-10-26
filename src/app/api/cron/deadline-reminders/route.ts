import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runDeadlineReminders } from '@/lib/leads/deadline-reminders'

export const maxDuration = 300

// Daily deadline reminders for confirmed layoff-deadline signups. Sends nothing until DEADLINE_REMINDER_EMAILS=1;
// off, the response is a dry run: counts only, no addresses.
export const GET = withCronRun('deadline-reminders', async () => NextResponse.json(await runDeadlineReminders()))
