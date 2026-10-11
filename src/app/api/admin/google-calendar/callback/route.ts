import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForAdminTokens } from '@/lib/webinars/admin-calendar-oauth'
import { fetchGoogleUserEmail } from '@/lib/google/oauth'
import { captureServerEvent } from '@/lib/posthog/server'

export async function GET(request: NextRequest) {
  await requireAdmin()

  const code = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')
  if (error || !code) {
    return NextResponse.redirect(new URL('/support/admin/webinars?calendarError=denied', request.url))
  }

  try {
    const tokens = await exchangeCodeForAdminTokens(code)
    if (!tokens.refresh_token) {
      return NextResponse.redirect(new URL('/support/admin/webinars?calendarError=no_refresh_token', request.url))
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // One row per Google account: reconnecting an account replaces its row,
    // connecting a different one adds another.
    const googleEmail = (await fetchGoogleUserEmail(tokens.access_token)).toLowerCase()
    const existing = await prisma.adminGoogleCalendarConnection.findUnique({ where: { googleEmail } })
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)
    if (existing) {
      await prisma.adminGoogleCalendarConnection.update({
        where: { id: existing.id },
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt,
          connectedByEmail: user?.email ?? existing.connectedByEmail,
        },
      })
    } else {
      await prisma.adminGoogleCalendarConnection.create({
        data: {
          googleEmail,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt,
          connectedByEmail: user?.email ?? null,
        },
      })
    }

    captureServerEvent(user?.email ?? 'admin', 'admin_calendar_connected', { googleEmail })
    return NextResponse.redirect(new URL('/support/admin/webinars?calendarConnected=1', request.url))
  } catch (err) {
    console.error('Admin Calendar OAuth callback failed:', err)
    return NextResponse.redirect(new URL('/support/admin/webinars?calendarError=exchange_failed', request.url))
  }
}
