import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { requireAdmin } from '@/lib/admin/auth'
import { buildGoogleAuthUrl } from '@/lib/google/oauth'

// Admin-gated on both ends (here and the callback), so this is a low-risk
// internal flow — no candidate or third-party account is ever involved.
export async function GET(request: NextRequest) {
  await requireAdmin()
  const state = crypto.randomBytes(16).toString('hex')

  try {
    const url = buildGoogleAuthUrl(state)
    return NextResponse.redirect(url)
  } catch {
    return NextResponse.redirect(
      new URL('/support/admin/digest?googleError=not_configured', request.url)
    )
  }
}
