import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { exchangeCodeForTokens, isCalendarTrackingTester } from '@/lib/calendar-tracking/google-calendar-oauth'
import { syncGoogleCalendarConnection } from '@/lib/calendar-tracking/sync-google-calendar'
import { prisma } from '@/lib/prisma'
import { getCurrentWeekSprint, logCatalogAction } from '@/lib/weekly/sprint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { captureServerEvent } from '@/lib/posthog/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.redirect(new URL('/dashboard/network?calendarError=not_logged_in', request.url))
  }
  // Second layer of the hard gate — checked again here, not just at /start,
  // since this route is independently reachable.
  if (!(await isCalendarTrackingTester(user.email))) {
    return NextResponse.redirect(new URL('/dashboard/network?calendarError=not_a_tester', request.url))
  }

  const code = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')
  if (error || !code) {
    return NextResponse.redirect(new URL('/dashboard/network?calendarError=denied', request.url))
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        new URL('/dashboard/network?calendarError=no_refresh_token', request.url)
      )
    }

    const profile = await getOrCreateCandidateProfile(user.id)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    // Upsert rather than create — a reconnect after a prior disconnect
    // reuses the same row (candidateId is unique) instead of erroring.
    const existing = await prisma.calendarConnection.findUnique({ where: { candidateId: profile.id } })
    const isFirstEverConnection = !existing

    const connection = await prisma.calendarConnection.upsert({
      where: { candidateId: profile.id },
      create: {
        candidateId: profile.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        disconnectedAt: null,
        needsReconnectAt: null,
      },
    })

    // Run the first sync immediately rather than waiting for the candidate
    // to separately discover and click "Sync now" on the Calendar Activity
    // page — best-effort, since the manual button is still a fallback.
    await syncGoogleCalendarConnection(connection.id).catch((error) =>
      console.error('Initial Calendar sync failed:', error)
    )

    // One-time connection bonus — awarded once ever per candidate, not on
    // every reconnect.
    if (isFirstEverConnection) {
      const sprint = await getCurrentWeekSprint(profile.id)
      if (sprint) {
        const effort = estimateActionEffort({ actionType: 'CALENDAR_CONNECTED' })
        await logCatalogAction(profile.id, {
          text: 'Connected your calendar so interviews and calls count automatically',
          actionType: 'CALENDAR_CONNECTED',
          points: effort.points,
          estimatedMinutes: effort.minutes,
          recurring: false,
        })
      }
      captureServerEvent(profile.id, 'calendar_connected')
    } else {
      captureServerEvent(profile.id, 'calendar_reconnected')
    }

    return NextResponse.redirect(new URL('/dashboard/network?calendarConnected=1', request.url))
  } catch (err) {
    console.error('Calendar OAuth callback failed:', err)
    return NextResponse.redirect(new URL('/dashboard/network?calendarError=exchange_failed', request.url))
  }
}
