import { NextResponse } from 'next/server'
import { autoAssignLists } from '@/lib/mailing/autoassign'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

/** Daily: subscribes new and re-typed CRM people to the lists that fit their type. */
export const GET = withCronRun('mailing-autoassign', async () => {
  const r = await autoAssignLists()
  return NextResponse.json({ scanned: r.scanned, added: r.added, unassigned: r.unassigned.length })
})
