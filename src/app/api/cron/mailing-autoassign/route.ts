import { NextResponse } from 'next/server'
import { autoAssignLists, pruneLists } from '@/lib/mailing/autoassign'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

/** Daily: cleans up stale and invalid memberships, then subscribes new and re-typed CRM people to the lists that fit their type. */
export const GET = withCronRun('mailing-autoassign', async () => {
  const pruned = await pruneLists()
  const r = await autoAssignLists()
  return NextResponse.json({ pruned, scanned: r.scanned, added: r.added, held: r.held, unassigned: r.unassigned.length })
})
