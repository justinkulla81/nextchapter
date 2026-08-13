import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { buildLinkedInAuthUrl, isLinkedInPostingConfigured } from '@/lib/linkedin/oauth'

// My Marketing Plan redesign — the "Post to LinkedIn" connect step.
// Unreachable today: isLinkedInPostingConfigured() is false until
// LINKEDIN_CLIENT_ID/SECRET are set, and the page never renders a link into
// this route in that case (see marketing-plan/page.tsx). Kept as a real,
// working route rather than a stub so connecting works the moment those two
// env vars are added — no further code changes needed.
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/dashboard/marketing-plan?linkedinError=not_logged_in', request.url))
  }
  if (!isLinkedInPostingConfigured()) {
    return NextResponse.redirect(new URL('/dashboard/marketing-plan?linkedinError=not_configured', request.url))
  }

  const state = crypto.randomBytes(16).toString('hex')
  try {
    const url = buildLinkedInAuthUrl(state)
    return NextResponse.redirect(url)
  } catch {
    return NextResponse.redirect(new URL('/dashboard/marketing-plan?linkedinError=not_configured', request.url))
  }
}
