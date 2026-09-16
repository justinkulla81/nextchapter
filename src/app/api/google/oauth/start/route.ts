import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { requireAdmin } from '@/lib/admin/auth'
import { buildGoogleAuthUrl } from '@/lib/google/oauth'

// Admin-gated on both ends (here and the callback), so this is a low-risk
// internal flow — no candidate or third-party account is ever involved.
//
// Optional ?from=<admin path> lets a second admin page (e.g. CRM Activity
// sync) also offer "Connect Gmail" and land back on itself afterward,
// instead of always landing on Market Pulse. Piggybacks on `state` — this
// still isn't real CSRF protection (the callback never checks it against a
// session-bound value, same pre-existing gap as the admin Calendar connect
// flow), just a carrier for the return path.
export async function GET(request: NextRequest) {
  await requireAdmin()
  const from = request.nextUrl.searchParams.get('from')
  const random = crypto.randomBytes(16).toString('hex')
  const state = from && from.startsWith('/support/admin/') ? `${random}:${encodeURIComponent(from)}` : random

  try {
    const url = buildGoogleAuthUrl(state)
    return NextResponse.redirect(url)
  } catch {
    return NextResponse.redirect(
      new URL(`${from && from.startsWith('/support/admin/') ? from : '/support/admin/digest'}?googleError=not_configured`, request.url)
    )
  }
}
