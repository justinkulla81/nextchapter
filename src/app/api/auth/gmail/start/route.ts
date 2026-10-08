import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildCandidateGmailAuthUrl,
  isGmailTrackingTester,
  notifyAdminGmailAccessNeeded,
} from '@/lib/email-tracking/gmail-oauth'
import { startErrorRedirectUrl, storeOAuthReturnState } from '@/lib/google/oauth-return-path'

// Prompt 76 — hard gate: no candidate outside the internal testing
// allow-list can even reach Google's consent screen. This is checked here
// (before any redirect to Google) and is the primary enforcement — Google's
// own test-user allow-list on the OAuth consent screen is the second layer,
// not the only one. The connect prompt itself is shown to every candidate
// (see GoogleConnectPrompt) — this gate, not client-side visibility, is
// what actually enforces the allow-list while the app stays in Google's
// unverified testing mode.
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
    const url = buildCandidateGmailAuthUrl(state)
    return NextResponse.redirect(url)
  } catch {
    return fail('not_configured')
  }
}
