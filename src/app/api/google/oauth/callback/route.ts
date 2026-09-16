import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens, fetchGoogleUserEmail } from '@/lib/google/oauth'
import { prisma } from '@/lib/prisma'
import { ADMIN_HOST } from '@/proxy'

// state is "<random>:<encoded return path>:<encoded admin email>", minted by
// /start (see its own comment for why this callback trusts state's contents
// instead of calling requireAdmin() — the short version: it can't. Google
// redirects here on whatever host NEXT_PUBLIC_APP_URL resolves to, which is
// the apex domain, but the admin session cookie is host-only scoped to
// admin.launchyournextchapter.com and is never present on this request).
function parseState(state: string | null): { returnPath: string; adminEmail: string | null } {
  const parts = state?.split(':') ?? []
  const decodedPath = parts[1] ? decodeURIComponent(parts[1]) : ''
  const returnPath = decodedPath.startsWith('/support/admin/') ? decodedPath : '/support/admin/digest'
  const adminEmail = parts[2] ? decodeURIComponent(parts[2]) || null : null
  return { returnPath, adminEmail }
}

// Every redirect back to the app must target the admin subdomain explicitly
// — building it from request.url would inherit the apex domain (where
// Google just redirected to), and admin pages redirect straight back off
// that domain per src/proxy.ts's own bounce rule, adding a pointless extra
// hop at best and landing on the wrong page's default state at worst.
function adminUrl(path: string): URL {
  return new URL(path, `https://${ADMIN_HOST}`)
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')
  const { returnPath, adminEmail } = parseState(request.nextUrl.searchParams.get('state'))

  if (error || !code) {
    return NextResponse.redirect(adminUrl(`${returnPath}?googleError=denied`))
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    if (!tokens.refresh_token) {
      // Google only issues a refresh_token on first-ever consent for this
      // app+account combination unless prompt=consent forces re-issue —
      // buildGoogleAuthUrl always sets that, so this should be rare. If it
      // happens anyway, the connection can't self-refresh later.
      return NextResponse.redirect(adminUrl(`${returnPath}?googleError=no_refresh_token`))
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
      update: { email, accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt, connectedByEmail: adminEmail ?? 'admin' },
      create: { email, accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt, connectedByEmail: adminEmail ?? 'admin' },
    })
    await prisma.adminGoogleCalendarConnection.upsert({
      where: { id: existingCalendar?.id ?? '' },
      update: { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt, connectedByEmail: adminEmail ?? existingCalendar?.connectedByEmail ?? null },
      create: { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt, connectedByEmail: adminEmail ?? null },
    })

    return NextResponse.redirect(adminUrl(`${returnPath}?googleConnected=1`))
  } catch (err) {
    console.error('Google OAuth callback failed:', err)
    // The failure reason is genuinely useful here and there's no server-log
    // access from the admin UI — surfacing a truncated message beats a bare
    // "exchange_failed" code that gives no clue which of several possible
    // causes (bad credentials, insufficient scope, network) actually fired.
    const message = err instanceof Error ? err.message : String(err)
    const url = adminUrl(`${returnPath}?googleError=exchange_failed`)
    url.searchParams.set('googleErrorDetail', message.slice(0, 300))
    return NextResponse.redirect(url)
  }
}
