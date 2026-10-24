import { NextResponse, type NextRequest } from 'next/server'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'
import { listCompetitorAwards, listOpenBoardBids } from '@/lib/bids/queries'

export const maxDuration = 60

// What the bid finder found lately, read by the daily digest. Read-only. Same Bearer key as warm-doors.
//   ?newSinceHours=26  how far back "new" reaches (default 26, one digest cycle)
export async function GET(request: NextRequest) {
  if (!isBearerAuthorized(request.headers.get('authorization'), process.env.NC_ATS_API_KEY)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const hours = Number(request.nextUrl.searchParams.get('newSinceHours'))
  const sinceHours = Number.isFinite(hours) && hours > 0 ? hours : 26
  try {
    const [bids, awards] = await Promise.all([
      listOpenBoardBids({ sinceHours }),
      listCompetitorAwards({ sinceHours, confidence: 'EXACT', limit: 100 }),
    ])
    const base = 'https://launchyournextchapter.com/support/admin/crm/funding'
    return NextResponse.json({
      newBoardBids: bids.map((b) => ({ board: b.boardName, state: b.state, title: b.title, deadline: b.deadline?.toISOString().slice(0, 10) ?? null, link: b.url, boardsViewUrl: `${base}/bids` })),
      newCompetitorAwards: awards.map((a) => ({ competitor: a.competitorName, kind: a.kind, agency: a.agency, amount: a.amount, startDate: a.startDate?.toISOString().slice(0, 10) ?? null, link: a.url, viewUrl: `${base}/competitor-wins` })),
    })
  } catch {
    return NextResponse.json({ newBoardBids: [], newCompetitorAwards: [], note: 'bid-finder tables not applied yet' })
  }
}
