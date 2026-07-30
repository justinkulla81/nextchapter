import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { buildCandidateCalendarAuthUrl, isCalendarTrackingTester } from '@/lib/calendar-tracking/google-calendar-oauth'

// Prompt 79 — hard gate: no candidate outside the internal testing
// allow-list can even reach Google's consent screen. Same convention as
// Gmail's start/route.ts — this is checked here (before any redirect to
// Google) as the primary enforcement, not just Google's own OAuth
// test-user allow-list.
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.redirect(new URL('/dashboard/calendar-activity?calendarError=not_logged_in', request.url))
  }

  if (!isCalendarTrackingTester(user.email)) {
    return NextResponse.redirect(new URL('/dashboard/calendar-activity?calendarError=not_a_tester', request.url))
  }

  const state = crypto.randomBytes(16).toString('hex')
  try {
    const url = buildCandidateCalendarAuthUrl(state)
    return NextResponse.redirect(url)
  } catch {
    return NextResponse.redirect(new URL('/dashboard/calendar-activity?calendarError=not_configured', request.url))
  }
}
