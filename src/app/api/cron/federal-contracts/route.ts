import { NextResponse, type NextRequest } from 'next/server'
import { syncFederalContracts } from '@/lib/companies/federal-contracts-sync'

export const maxDuration = 300

// Nightly: look up federal contract awards for the next slice of directory companies
// (USAspending.gov, free, no key; no AI call). Stops at its own deadline so a slow API
// cannot run the function out of time; the rest is picked up the next night.
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await syncFederalContracts({ limit: 150, deadlineMs: 240_000 })
  return NextResponse.json(result)
}
