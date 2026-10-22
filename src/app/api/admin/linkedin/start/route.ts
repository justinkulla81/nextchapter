import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { buildPageAuthUrl, isPagePostingConfigured } from '@/lib/linkedin/page-posting'
import { mintAdminLinkedInState } from '@/lib/linkedin/admin-state'

/**
 * Starts "Connect the NextChapter page" for the admin queue: posts go out as the company page, never as a person.
 * Uses the separate "NextChapter Publishing" LinkedIn app (the Community Management API product), whose callback is
 * the same main-site URL; the signed state tells the callback this is the admin.
 */
export async function GET(request: Request) {
  const admin = await requireAdmin()
  if (!isPagePostingConfigured() || !admin.email) {
    return NextResponse.redirect(new URL('/support/admin/linkedin-drafts?linkedin=not_configured', request.url))
  }
  return NextResponse.redirect(buildPageAuthUrl(mintAdminLinkedInState(admin.email)))
}
