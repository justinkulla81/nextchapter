import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { buildCandidateGmailAuthUrl, isGmailTrackingTester } from '@/lib/email-tracking/gmail-oauth'

// Prompt 76 — hard gate: no candidate outside the internal testing
// allow-list can even reach Google's consent screen. This is checked here
// (before any redirect to Google) and is the primary enforcement — Google's
// own test-user allow-list on the OAuth consent screen is the second layer,
// not the only one.
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.redirect(new URL('/dashboard/network?gmailError=not_logged_in', request.url))
  }

  if (!(await isGmailTrackingTester(user.email))) {
    return NextResponse.redirect(new URL('/dashboard/network?gmailError=not_a_tester', request.url))
  }

  const state = crypto.randomBytes(16).toString('hex')
  try {
    const url = buildCandidateGmailAuthUrl(state)
    return NextResponse.redirect(url)
  } catch {
    return NextResponse.redirect(new URL('/dashboard/network?gmailError=not_configured', request.url))
  }
}
