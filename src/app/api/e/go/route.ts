import { NextResponse, type NextRequest } from 'next/server'
import { captureServerEvent } from '@/lib/posthog/server'
import { readEmailClickUrl } from '@/lib/email/click-link'

// A tracked link in a weekly lifecycle email. Records `email_clicked` against
// the member and redirects. A bad signature goes to the homepage; a tracking
// failure never blocks the redirect.
export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  const parsed = readEmailClickUrl(request.nextUrl.searchParams)
  if (!parsed) return NextResponse.redirect(new URL('/', appUrl))
  try {
    captureServerEvent(parsed.candidateId, 'email_clicked', { email_key: parsed.emailKey, destination: parsed.url })
  } catch (error) {
    console.error('Failed to record email click:', error)
  }
  return NextResponse.redirect(parsed.url)
}
