import { NextResponse } from 'next/server'
import { verifyListMembers } from '@/lib/mailing/verify-members'
import { pruneLists } from '@/lib/mailing/autoassign'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

/** Hourly: checks up to 100 never-checked list addresses with Hunter (P0 first), then suppresses any it finds invalid. */
export const GET = withCronRun('mailing-verify', async () => {
  const verified = await verifyListMembers()
  const pruned = verified.invalid > 0 ? await pruneLists() : null
  return NextResponse.json({ verified, pruned })
})
