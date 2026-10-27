import { NextResponse, type NextRequest } from 'next/server'
import { allowByIp, HOUR_MS } from '@/lib/security/rate-limit'
import { lookupEmployers } from '@/lib/layoff-risk/context'

// The layoff risk check's employer search: a few names and their filing facts. Read-only, public data (the same notices the layoff pages
// list), rate limited by address. Under /api, so crawlers skip it (robots disallows it).
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').slice(0, 80)
  if (q.trim().length < 2) return NextResponse.json({ employers: [] })
  if (!(await allowByIp('layoff-lookup', 180, HOUR_MS))) return NextResponse.json({ error: 'Too many searches. Try again in a few minutes.' }, { status: 429 })
  try {
    const employers = await lookupEmployers(q)
    return NextResponse.json({ employers }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } })
  } catch (e) {
    console.error('layoff employer lookup failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ employers: [] }, { status: 200 })
  }
}
