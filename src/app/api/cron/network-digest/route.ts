import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runNetworkDigest } from '@/lib/email/dispatch/run-network-digest'

export const maxDuration = 300

// Tuesdays, in the digests bundle. Emails members of a role, function or industry network (CRO, Sales, Health care, ...) its open jobs and what other
// members posted. Who is skipped and why is in run-network-digest.ts. Members already sent this week are skipped,
// so re-running by hand is safe.
export const GET = withCronRun('network-digest', async () => {
  const result = await runNetworkDigest()
  return NextResponse.json(result, { status: 'failed' in result && result.failed > 0 ? 500 : 200 })
})
