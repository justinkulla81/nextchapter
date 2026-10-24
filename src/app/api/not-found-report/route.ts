import { NextResponse, type NextRequest } from 'next/server'
import { allowByIp, HOUR_MS } from '@/lib/security/rate-limit'
import { alertNotFound } from '@/lib/not-found/alert'

// The page-not-found screen calls this once so the owner is emailed about a missing page. Unauthenticated by
// nature, so it is capped per network, takes a small body, and always answers 204.
export async function POST(request: NextRequest) {
  if (!(await allowByIp('not-found-report', 30, HOUR_MS))) return new NextResponse(null, { status: 204 })
  const text = await request.text().catch(() => '')
  if (!text || text.length > 2048) return new NextResponse(null, { status: 204 })
  try {
    const body = JSON.parse(text) as Record<string, unknown>
    await alertNotFound({ path: body.path, host: request.headers.get('host'), referrer: body.referrer })
  } catch {
    // Not valid JSON; ignore.
  }
  return new NextResponse(null, { status: 204 })
}
