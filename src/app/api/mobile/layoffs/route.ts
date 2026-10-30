import { NextResponse, type NextRequest } from 'next/server'
import { allowByIp, HOUR_MS } from '@/lib/security/rate-limit'
import { queryLayoffs, validState } from '@/lib/layoffs/public-query'

export const maxDuration = 30

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' }
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// The app's layoff feed: recent WARN filings, newest first, optionally one state or one employer. Same data and figures as
// /layoffs and /api/public/layoffs. The "is my employer filing" lookup is /api/layoffs/employer-lookup.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  if (!(await allowByIp('mobile-layoffs', 300, HOUR_MS))) return NextResponse.json({ error: 'Too many requests. Try again in a few minutes.' }, { status: 429, headers: CORS })
  const state = sp.get('state')
  if (!validState(state)) return NextResponse.json({ error: 'state must be a two-letter U.S. state code.' }, { status: 400, headers: CORS })
  const num = (k: string) => {
    const v = sp.get(k)
    return v && /^\d{1,3}$/.test(v) ? Number(v) : null
  }
  try {
    const answer = await queryLayoffs({ state, employer: sp.get('employer')?.slice(0, 80), days: num('days') ?? 30, limit: num('limit') ?? 30 })
    return NextResponse.json(answer, { headers: { ...CORS, 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' } })
  } catch (e) {
    console.error('mobile layoffs failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Temporarily unavailable. Try again in a minute.' }, { status: 503, headers: CORS })
  }
}
