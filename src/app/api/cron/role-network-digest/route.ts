import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runRoleNetworkDigest } from '@/lib/email/dispatch/run-role-network-digest'

export const maxDuration = 300

// Tuesdays, in the digests bundle. Emails members of a role network (CRO, CFO, ...) the role's open jobs and what other
// members posted. Who is skipped and why is in run-role-network-digest.ts. Members already sent this week are skipped,
// so re-running by hand is safe.
export const GET = withCronRun('role-network-digest', async () => {
  const result = await runRoleNetworkDigest()
  return NextResponse.json(result, { status: 'failed' in result && result.failed > 0 ? 500 : 200 })
})
