import { after, NextResponse, type NextRequest } from 'next/server'
import { allowByIp, HOUR_MS } from '@/lib/security/rate-limit'
import { alertNotFound } from '@/lib/not-found/alert'

export const maxDuration = 300

// The page-not-found screen calls this once so the owner is emailed about a missing page. Unauthenticated by
// nature, so it is capped per network, takes a small body, and always answers 204.
export async function POST(request: NextRequest) {
  if (!(await allowByIp('not-found-report', 30, HOUR_MS))) return new NextResponse(null, { status: 204 })
  const text = await request.text().catch(() => '')
  if (!text || text.length > 2048) return new NextResponse(null, { status: 204 })
  try {
    const body = JSON.parse(text) as Record<string, unknown>
    const input = { path: body.path, host: request.headers.get('host'), referrer: body.referrer }
    // Answered at once; the alert waits out a deploy and re-checks the page before it emails.
    after(() => alertNotFound(input).catch(() => false))
  } catch {
    // Not valid JSON; ignore.
  }
  return new NextResponse(null, { status: 204 })
}
