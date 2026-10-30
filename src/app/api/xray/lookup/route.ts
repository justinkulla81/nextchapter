import { NextResponse, type NextRequest } from 'next/server'
import { allowByIp, HOUR_MS } from '@/lib/security/rate-limit'
import { xrayLookup } from '@/lib/xray/lookup'
import { XRAY_CORS } from '@/lib/xray/cors'

// Job X-ray (Chrome extension): AI exposure, layoff facts and the pay median for a job title and employer name. Public data, no
// model call, no auth, cached at the edge by title+employer. Rate limited by address. Under /api, so crawlers skip it.
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams
  const title = (p.get('title') ?? '').slice(0, 120)
  const employer = (p.get('employer') ?? '').slice(0, 120)
  if (title.trim().length < 2) return NextResponse.json({ error: 'title required' }, { status: 400, headers: XRAY_CORS })
  if (!(await allowByIp('xray-lookup', 240, HOUR_MS))) return NextResponse.json({ error: 'Too many lookups. Try again in a few minutes.' }, { status: 429, headers: XRAY_CORS })
  try {
    const result = await xrayLookup(title, employer)
    return NextResponse.json(result, { headers: { ...XRAY_CORS, 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } })
  } catch (e) {
    console.error('xray lookup failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: XRAY_CORS })
  }
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: XRAY_CORS })
}
