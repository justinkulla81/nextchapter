import { NextResponse, type NextRequest } from 'next/server'
import { allowByIp, HOUR_MS } from '@/lib/security/rate-limit'

// Receives Content-Security-Policy violation reports (the CSP header names
// this path in report-uri). Report-only mode is only useful if someone can see
// what it would have blocked: each report is logged as one short line to the
// Vercel runtime logs ("CSP violation: ..."), and nothing is stored.
//
// Unauthenticated by nature, so it is capped per network and per body, logs
// only origins and directive names (never full URLs or query strings), and
// always answers 204.
const MAX_BODY_BYTES = 8 * 1024

function originOf(value: unknown): string {
  if (typeof value !== 'string' || !value) return 'unknown'
  if (['inline', 'eval', 'data', 'blob', 'self'].includes(value)) return value
  try {
    const u = new URL(value)
    return `${u.protocol}//${u.host}`
  } catch {
    return value.slice(0, 40)
  }
}

export async function POST(request: NextRequest) {
  if (!(await allowByIp('csp-report', 120, HOUR_MS))) return new NextResponse(null, { status: 204 })

  const text = await request.text().catch(() => '')
  if (!text || text.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 204 })

  try {
    const parsed = JSON.parse(text) as Record<string, Record<string, unknown>>
    const r = parsed['csp-report'] ?? {}
    const doc = (() => {
      try {
        return new URL(String(r['document-uri'])).pathname
      } catch {
        return 'unknown'
      }
    })()
    console.warn(
      `CSP violation: directive=${String(r['effective-directive'] ?? r['violated-directive'] ?? 'unknown').slice(0, 40)} ` +
        `blocked=${originOf(r['blocked-uri'])} page=${doc.slice(0, 80)}`,
    )
  } catch {
    // Not a report; ignore.
  }
  return new NextResponse(null, { status: 204 })
}
