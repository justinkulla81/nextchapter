import { NextResponse } from 'next/server'
import { autoAssignLists, pruneLists } from '@/lib/mailing/autoassign'
import { syncRegisteredCandidates } from '@/lib/mailing/lists'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

/** Daily: cleans up stale and invalid memberships, then adds registered members to Candidates, then subscribes new and re-typed CRM people to the lists that fit their type. */
export const GET = withCronRun('mailing-autoassign', async () => {
  const pruned = await pruneLists()
  const candidates = await syncRegisteredCandidates()
  const r = await autoAssignLists()
  return NextResponse.json({ pruned, candidatesAdded: candidates, scanned: r.scanned, added: r.added, held: r.held, unassigned: r.unassigned.length })
})
