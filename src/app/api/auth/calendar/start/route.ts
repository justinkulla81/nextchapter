import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildCandidateCalendarAuthUrl, isCalendarTrackingTester } from '@/lib/calendar-tracking/google-calendar-oauth'
import { notifyAdminGmailAccessNeeded } from '@/lib/email-tracking/gmail-oauth'
import { startErrorRedirectUrl, storeOAuthReturnState } from '@/lib/google/oauth-return-path'

// Prompt 79 — hard gate: no candidate outside the internal testing
// allow-list can even reach Google's consent screen. Same convention as
// Gmail's start/route.ts — this is checked here (before any redirect to
// Google) as the primary enforcement, not just Google's own OAuth
// test-user allow-list.
export async function GET(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get('returnTo')
  const fail = (code: string) =>
    NextResponse.redirect(startErrorRedirectUrl(returnTo, '/dashboard/network', 'calendarError', code, request.url))
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return fail('not_logged_in')
  }

  if (!(await isCalendarTrackingTester(user.email))) {
    notifyAdminGmailAccessNeeded(user.email).catch((error) =>
      console.error('Failed to notify admin of Gmail access request:', error)
    )
    return fail('not_a_tester')
  }

  const state = await storeOAuthReturnState(returnTo, '/dashboard/network')
  try {
    const url = buildCandidateCalendarAuthUrl(state)
    return NextResponse.redirect(url)
  } catch {
    return fail('not_configured')
  }
}
