import { NextResponse, type NextRequest } from 'next/server'
import { allowByIp, HOUR_MS } from '@/lib/security/rate-limit'
import { queryLayoffs, validState } from '@/lib/layoffs/public-query'

export const maxDuration = 30

// A free, read-only JSON view of the layoff notices behind /layoffs, for scripts and AI agents. Described at /api/public/openapi.json.
// Same data and license (CC BY 4.0, link back) as the pages and /data/layoffs.csv. Limited per network address.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' }

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  if (!(await allowByIp('public-layoffs-api', 300, HOUR_MS))) {
    return NextResponse.json({ error: 'Too many requests from this network. Try again later, or download the full file at https://launchyournextchapter.com/data/layoffs.csv.' }, { status: 429, headers: CORS })
  }
  const state = sp.get('state')
  if (!validState(state)) return NextResponse.json({ error: 'state must be a two-letter U.S. state code, such as TX.' }, { status: 400, headers: CORS })
  const num = (k: string) => {
    const v = sp.get(k)
    return v && /^\d{1,4}$/.test(v) ? Number(v) : null
  }
  try {
    const answer = await queryLayoffs({ state, employer: sp.get('employer')?.slice(0, 80), days: num('days'), limit: num('limit') })
    return NextResponse.json(answer, { headers: { ...CORS, 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } })
  } catch (error) {
    console.error('public layoffs api failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Temporarily unavailable. Try again in a minute.' }, { status: 503, headers: CORS })
  }
}
