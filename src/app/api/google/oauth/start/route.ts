import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { requireAdmin } from '@/lib/admin/auth'
import { buildGoogleAuthUrl } from '@/lib/google/oauth'

// Admin-gated here — but NOT re-checked on the callback, because it
// structurally can't be: Google redirects back to whatever host
// NEXT_PUBLIC_APP_URL resolves to (the apex domain, since that's the
// registered redirect URI), while the admin session cookie is deliberately
// host-only scoped to admin.launchyournextchapter.com (see src/proxy.ts) so
// it never shares a cookie jar with the candidate site. A requireAdmin()
// call in the callback would see no cookie there and silently fail every
// time — which is exactly what happened before this fix (GoogleInboxConnection
// stayed empty through every previous attempt, on this flow and the
// admin-calendar one, which has the identical gap and has apparently never
// been exercised either). The real trust boundary is this endpoint: only an
// admin session on the admin subdomain can reach here and mint a `state`,
// and only Google's own login+consent for our specific OAuth client can turn
// that into a valid `code` — the callback trusts state's contents (return
// path, and this admin's email for attribution) rather than re-deriving them
// from a cookie that will never be there.
//
// Optional ?from=<admin path> lets a second admin page (e.g. CRM Activity
// sync) also offer "Connect Gmail" and land back on itself afterward,
// instead of always landing on Market Pulse.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  const from = request.nextUrl.searchParams.get('from')
  const validFrom = from && from.startsWith('/support/admin/') ? from : null
  const random = crypto.randomBytes(16).toString('hex')
  const state = `${random}:${encodeURIComponent(validFrom ?? '')}:${encodeURIComponent(admin?.email ?? '')}`

  try {
    const url = buildGoogleAuthUrl(state)
    return NextResponse.redirect(url)
  } catch {
    return NextResponse.redirect(
      new URL(`${validFrom ?? '/support/admin/digest'}?googleError=not_configured`, request.url)
    )
  }
}
