import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { exchangeCodeForTokens, fetchGoogleUserEmail } from '@/lib/google/oauth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  const code = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(new URL('/support/admin/digest?googleError=denied', request.url))
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    if (!tokens.refresh_token) {
      // Google only issues a refresh_token on first-ever consent for this
      // app+account combination unless prompt=consent forces re-issue —
      // buildGoogleAuthUrl always sets that, so this should be rare. If it
      // happens anyway, the connection can't self-refresh later.
      return NextResponse.redirect(new URL('/support/admin/digest?googleError=no_refresh_token', request.url))
    }

    const email = await fetchGoogleUserEmail(tokens.access_token)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    await prisma.googleInboxConnection.create({
      data: {
        email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        connectedByEmail: admin?.email ?? 'admin',
      },
    })

    return NextResponse.redirect(new URL('/support/admin/digest?googleConnected=1', request.url))
  } catch (err) {
    console.error('Google OAuth callback failed:', err)
    return NextResponse.redirect(new URL('/support/admin/digest?googleError=exchange_failed', request.url))
  }
}
