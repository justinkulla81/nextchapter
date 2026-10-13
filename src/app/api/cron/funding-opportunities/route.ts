import { NextResponse, type NextRequest } from 'next/server'
import { syncFundingOpportunities } from '@/lib/funding-opportunities/sync'
import { captureServerEvent } from '@/lib/posthog/server'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'

export const maxDuration = 300

// Daily: open federal grants (Grants.gov) and solicitations / RFIs (SAM.gov) in
// our subject area, filed in the CRM as a note and a deadline on the issuing
// agency. ?dryRun=1 searches and reports without writing.
export async function GET(request: NextRequest) {
  if (!isBearerAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1'
  const result = await syncFundingOpportunities({ dryRun })
  captureServerEvent('cron', 'funding_opportunities_synced', {
    dryRun,
    grantsSearched: result.grants.searched,
    grantsFailed: result.grants.failed.length,
    samSearched: result.sam.searched,
    samSkipped: result.sam.skipped,
    relevant: result.relevant,
    filed: result.filed,
    alreadyLogged: result.alreadyLogged,
  })
  return NextResponse.json(result)
}
