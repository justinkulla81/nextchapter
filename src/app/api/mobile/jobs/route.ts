import { NextResponse, type NextRequest } from 'next/server'
import { allowByIp, HOUR_MS } from '@/lib/security/rate-limit'
import { searchPublicBoardCached } from '@/lib/jobs/public-board'
import { mobileJobQuery } from '@/lib/mobile/params'

export const maxDuration = 30

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' }
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// The app's job search: the same live professional jobs and filters as the website's /jobs, plus a minimum pay and paging.
// Each job carries `url`, the employer's own career-site apply link. Cached five minutes per query, limited by address.
export async function GET(request: NextRequest) {
  if (!(await allowByIp('mobile-jobs', 300, HOUR_MS))) return NextResponse.json({ error: 'Too many searches. Try again in a few minutes.' }, { status: 429, headers: CORS })
  try {
    const query = mobileJobQuery(request.nextUrl.searchParams)
    const result = await searchPublicBoardCached(query)
    return NextResponse.json(result, { headers: { ...CORS, 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } })
  } catch (e) {
    console.error('mobile job search failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Search is unavailable right now. Try again in a minute.' }, { status: 503, headers: CORS })
  }
}
