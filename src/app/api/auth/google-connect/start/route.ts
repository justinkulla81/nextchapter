import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildCombinedGoogleAuthUrl,
  isGmailTrackingTester,
  notifyAdminGmailAccessNeeded,
} from '@/lib/email-tracking/gmail-oauth'
import { startErrorRedirectUrl, storeOAuthReturnState } from '@/lib/google/oauth-return-path'

// Combined Gmail + Calendar Connect — same hard gate as the individual
// /api/auth/gmail/start and /api/auth/calendar/start routes (both features
// share one allow-list, see isGmailTrackingTester's own comment).
export async function GET(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get('returnTo')
  const fail = (code: string) =>
    NextResponse.redirect(startErrorRedirectUrl(returnTo, '/dashboard/network', 'gmailError', code, request.url))
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return fail('not_logged_in')
  }

  if (!(await isGmailTrackingTester(user.email))) {
    notifyAdminGmailAccessNeeded(user.email).catch((error) =>
      console.error('Failed to notify admin of Gmail access request:', error)
    )
    return fail('not_a_tester')
  }

  const state = await storeOAuthReturnState(returnTo, '/dashboard/network')
  try {
    const url = buildCombinedGoogleAuthUrl(state)
    return NextResponse.redirect(url)
  } catch {
    return fail('not_configured')
  }
}
