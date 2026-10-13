import { NextResponse } from 'next/server'
import { syncFederalContracts } from '@/lib/companies/federal-contracts-sync'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

// Nightly: look up federal contract awards for the next slice of directory companies
// (USAspending.gov, free, no key; no AI call). Stops at its own deadline so a slow API
// cannot run the function out of time; the rest is picked up the next night.
export const GET = withCronRun('federal-contracts', async () => {
  const result = await syncFederalContracts({ limit: 150, deadlineMs: 240_000 })
  return NextResponse.json(result)
})
