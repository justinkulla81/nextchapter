import { NextResponse, type NextRequest } from 'next/server'
import { syncCompetitorAwards } from '@/lib/bids/awards-sync'
import { fileAwardsToCrm } from '@/lib/bids/crm-filing'
import { captureServerEvent } from '@/lib/posthog/server'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

// Daily slice: federal contracts and grants won by competitors (USAspending.gov, free, no key, no AI).
// Competitors re-checked every two weeks, least recently checked first. ?dryRun=1 reports without writing.
export const GET = withCronRun('competitor-awards', async (request: NextRequest) => {
  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1'
  const result = await syncCompetitorAwards({ deadlineMs: 200_000, dryRun })
  // Then file confident wins on the competitor's and the buyer's CRM organizations.
  const crm = dryRun ? null : await fileAwardsToCrm({ deadlineMs: 40_000 }).catch((e) => ({ error: String(e).slice(0, 200) }))
  captureServerEvent('cron', 'competitor_awards_synced', { checked: result.checked, withAwards: result.withAwards, newAwards: result.newAwards, failed: result.failed, crmFiled: crm && 'filed' in crm ? crm.filed : 0 })
  return NextResponse.json({ ...result, crm })
})
