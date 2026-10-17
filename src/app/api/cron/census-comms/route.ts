import { NextResponse } from 'next/server'
import { runCollegeInviteReminders, runOutplacementComms } from '@/lib/census/comms'
import { captureServerEvent } from '@/lib/posthog/server'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

// Daily: the census emails each org switched on (join reminders, access-ending notices).
export const GET = withCronRun('census-comms', async () => {
  const outplacement = await runOutplacementComms()
  const colleges = await runCollegeInviteReminders()
  captureServerEvent('cron', 'census_comms_run', { ...outplacement, collegeReminders: colleges.sent })
  return NextResponse.json({ ok: true, outplacement, colleges })
})
