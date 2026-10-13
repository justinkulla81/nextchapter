import { NextResponse, type NextRequest } from 'next/server'
import { loadWarmDoors } from '@/lib/crm/warm-doors'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'
import { captureServerEvent } from '@/lib/posthog/server'

export const maxDuration = 60

// Strong candidates who want to work somewhere we have a warm way in — read by
// the daily digest so Justin hears about them and can help. Read-only, and it
// writes nothing to the CRM. Same Bearer key as the p0-leads import.
//
//   ?newSinceHours=26  how far back "new" reaches (default 26, one digest cycle)
//   ?onlyNew=1         only candidates whose interest began inside that window
//   ?orgId=...         one organization
export async function GET(request: NextRequest) {
  if (!isBearerAuthorized(request.headers.get('authorization'), process.env.NC_ATS_API_KEY)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const params = request.nextUrl.searchParams
  const hours = Number(params.get('newSinceHours'))
  const items = await loadWarmDoors({
    orgId: params.get('orgId') ?? undefined,
    newSinceHours: Number.isFinite(hours) && hours > 0 ? hours : undefined,
  })
  const shown = params.get('onlyNew') === '1' ? items.filter((i) => i.isNew) : items

  captureServerEvent('daily-digest', 'crm_warm_doors_read', {
    total: items.length, applied: items.filter((i) => i.kind === 'applied').length, new: items.filter((i) => i.isNew).length,
  })

  return NextResponse.json({
    count: shown.length,
    items: shown.map((i) => ({
      ...i,
      candidateUrl: `/support/admin/candidates/${i.candidate.id}`,
      orgUrl: `/support/admin/crm/organizations/${i.org.slug ?? i.org.id}`,
    })),
  })
}
