import { NextResponse, type NextRequest } from 'next/server'
import { syncCompetitorAwards } from '@/lib/bids/awards-sync'
import { captureServerEvent } from '@/lib/posthog/server'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

// Daily slice: federal contracts and grants won by competitors (USAspending.gov, free, no key, no AI).
// Competitors re-checked every two weeks, least recently checked first. ?dryRun=1 reports without writing.
export const GET = withCronRun('competitor-awards', async (request: NextRequest) => {
  const result = await syncCompetitorAwards({ deadlineMs: 240_000, dryRun: request.nextUrl.searchParams.get('dryRun') === '1' })
  captureServerEvent('cron', 'competitor_awards_synced', { checked: result.checked, withAwards: result.withAwards, newAwards: result.newAwards, failed: result.failed })
  return NextResponse.json(result)
})
