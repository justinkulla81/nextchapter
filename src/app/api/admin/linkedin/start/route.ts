import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { buildLinkedInAuthUrl, isLinkedInPostingConfigured } from '@/lib/linkedin/oauth'
import { mintAdminLinkedInState } from '@/lib/linkedin/admin-state'

/** Starts "Connect LinkedIn" for the admin queue. Reuses the LinkedIn app's existing redirect URL; the signed state tells the callback this is the admin. */
export async function GET(request: Request) {
  const admin = await requireAdmin()
  if (!isLinkedInPostingConfigured() || !admin.email) {
    return NextResponse.redirect(new URL('/support/admin/linkedin-drafts?linkedin=not_configured', request.url))
  }
  return NextResponse.redirect(buildLinkedInAuthUrl(mintAdminLinkedInState(admin.email), { admin: true }))
}
