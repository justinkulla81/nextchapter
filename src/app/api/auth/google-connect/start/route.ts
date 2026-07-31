import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { buildCombinedGoogleAuthUrl, isGmailTrackingTester } from '@/lib/email-tracking/gmail-oauth'

// Combined Gmail + Calendar Connect — same hard gate as the individual
// /api/auth/gmail/start and /api/auth/calendar/start routes (both features
// share one allow-list, see isGmailTrackingTester's own comment).
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.redirect(new URL('/dashboard/email-activity?gmailError=not_logged_in', request.url))
  }

  if (!(await isGmailTrackingTester(user.email))) {
    return NextResponse.redirect(new URL('/dashboard/email-activity?gmailError=not_a_tester', request.url))
  }

  const state = crypto.randomBytes(16).toString('hex')
  try {
    const url = buildCombinedGoogleAuthUrl(state)
    return NextResponse.redirect(url)
  } catch {
    return NextResponse.redirect(new URL('/dashboard/email-activity?gmailError=not_configured', request.url))
  }
}
