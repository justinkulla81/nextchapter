import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildCombinedGoogleAuthUrl,
  isGmailTrackingTester,
  notifyAdminGmailAccessNeeded,
} from '@/lib/email-tracking/gmail-oauth'
import { storeOAuthReturnState } from '@/lib/google/oauth-return-path'

// Combined Gmail + Calendar Connect — same hard gate as the individual
// /api/auth/gmail/start and /api/auth/calendar/start routes (both features
// share one allow-list, see isGmailTrackingTester's own comment).
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.redirect(new URL('/dashboard/network?gmailError=not_logged_in', request.url))
  }

  if (!(await isGmailTrackingTester(user.email))) {
    notifyAdminGmailAccessNeeded(user.email).catch((error) =>
      console.error('Failed to notify admin of Gmail access request:', error)
    )
    return NextResponse.redirect(new URL('/dashboard/network?gmailError=not_a_tester', request.url))
  }

  const state = await storeOAuthReturnState(request.nextUrl.searchParams.get('returnTo'), '/dashboard/network')
  try {
    const url = buildCombinedGoogleAuthUrl(state)
    return NextResponse.redirect(url)
  } catch {
    return NextResponse.redirect(new URL('/dashboard/network?gmailError=not_configured', request.url))
  }
}
