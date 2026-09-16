import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { exchangeCodeForTokens, fetchGoogleUserEmail } from '@/lib/google/oauth'
import { prisma } from '@/lib/prisma'

// If /start was called with ?from=<admin path>, that path is carried here
// inside `state` (see start/route.ts) so this can redirect back to whichever
// admin page initiated the connection, defaulting to Market Pulse otherwise.
function returnPathFrom(state: string | null): string {
  const encoded = state?.split(':')[1]
  if (!encoded) return '/support/admin/digest'
  const path = decodeURIComponent(encoded)
  return path.startsWith('/support/admin/') ? path : '/support/admin/digest'
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  const code = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')
  const returnPath = returnPathFrom(request.nextUrl.searchParams.get('state'))

  if (error || !code) {
    return NextResponse.redirect(new URL(`${returnPath}?googleError=denied`, request.url))
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    if (!tokens.refresh_token) {
      // Google only issues a refresh_token on first-ever consent for this
      // app+account combination unless prompt=consent forces re-issue —
      // buildGoogleAuthUrl always sets that, so this should be rare. If it
      // happens anyway, the connection can't self-refresh later.
      return NextResponse.redirect(new URL(`${returnPath}?googleError=no_refresh_token`, request.url))
    }

    const email = await fetchGoogleUserEmail(tokens.access_token)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    // One consent grant, two connections — the requested scope (see
    // src/lib/google/oauth.ts) covers both Gmail read and Calendar write, so
    // a single "Connect Google" click sets up everything that reads from
    // either GoogleInboxConnection (Market Pulse, CRM email sweep) or
    // AdminGoogleCalendarConnection (CRM meeting sweep, Webinar scheduling).
    // Both are singletons — replaced on reconnect rather than accumulating
    // rows, same pattern the calendar-only flow already used.
    const [existingInbox, existingCalendar] = await Promise.all([
      prisma.googleInboxConnection.findFirst(),
      prisma.adminGoogleCalendarConnection.findFirst(),
    ])

    await prisma.googleInboxConnection.upsert({
      where: { id: existingInbox?.id ?? '' },
      update: { email, accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt, connectedByEmail: admin?.email ?? 'admin' },
      create: { email, accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt, connectedByEmail: admin?.email ?? 'admin' },
    })
    await prisma.adminGoogleCalendarConnection.upsert({
      where: { id: existingCalendar?.id ?? '' },
      update: { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt, connectedByEmail: admin?.email ?? existingCalendar?.connectedByEmail ?? null },
      create: { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt, connectedByEmail: admin?.email ?? null },
    })

    return NextResponse.redirect(new URL(`${returnPath}?googleConnected=1`, request.url))
  } catch (err) {
    console.error('Google OAuth callback failed:', err)
    return NextResponse.redirect(new URL(`${returnPath}?googleError=exchange_failed`, request.url))
  }
}
