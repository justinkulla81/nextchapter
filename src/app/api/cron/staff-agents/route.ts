import { NextResponse } from 'next/server'
import { runStaffAgentsDaily } from '@/lib/staff-agents/run'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

// Daily: the staff agents (rapid response today) draft work for each organization that switched them on. Does nothing while STAFF_AGENTS_ENABLED is off.
export const GET = withCronRun('staff-agents', async () => NextResponse.json({ ok: true, ...(await runStaffAgentsDaily()) }))
