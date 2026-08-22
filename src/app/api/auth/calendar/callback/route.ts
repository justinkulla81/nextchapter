import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { exchangeCodeForTokens, isCalendarTrackingTester } from '@/lib/calendar-tracking/google-calendar-oauth'
import { syncGoogleCalendarConnection } from '@/lib/calendar-tracking/sync-google-calendar'
import { prisma } from '@/lib/prisma'
import { getCurrentWeekSprint, logCatalogAction } from '@/lib/weekly/sprint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { captureServerEvent } from '@/lib/posthog/server'
import { consumeOAuthReturnState } from '@/lib/google/oauth-return-path'

// Backgrounded first-sync (below) can still take a while on a heavy real
// calendar, so this gets real headroom rather than the platform default.
export const maxDuration = 300

export async function GET(request: NextRequest) {
  // See gmail/callback/route.ts's identical comment — resolved once so
  // every redirect below returns to wherever the candidate started, and
  // doubles as the real CSRF check on Google's `state` param.
  const returnTo = await consumeOAuthReturnState(request.nextUrl.searchParams.get('state'), '/dashboard/network')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.redirect(new URL(`${returnTo}?calendarError=not_logged_in`, request.url))
  }
  // Second layer of the hard gate — checked again here, not just at /start,
  // since this route is independently reachable.
  if (!(await isCalendarTrackingTester(user.email))) {
    return NextResponse.redirect(new URL(`${returnTo}?calendarError=not_a_tester`, request.url))
  }

  const code = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')
  if (error || !code) {
    return NextResponse.redirect(new URL(`${returnTo}?calendarError=denied`, request.url))
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        new URL(`${returnTo}?calendarError=no_refresh_token`, request.url)
      )
    }

    const profile = await getOrCreateCandidateProfile(user.id)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    // Upsert rather than create — a reconnect after a prior disconnect
    // reuses the same row (candidateId is unique) instead of erroring.
    const existing = await prisma.calendarConnection.findUnique({ where: { candidateId: profile.id } })
    const isFirstEverConnection = !existing
    // Captured before the upsert clears it — true only when this callback
    // is genuinely completing a reconnect of an expired connection, not an
    // incidental re-hit of this route on an already-healthy connection.
    const isGenuineReconnect = !!existing?.needsReconnectAt

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

    // Kick off the first sync right away rather than waiting for the
    // candidate to separately discover and click "Sync now" on the
    // Calendar Activity page. Backgrounded via after(): a real calendar
    // history can take long enough to sync that awaiting it here was
    // blocking this redirect long enough to hit the platform's function
    // timeout (504 FUNCTION_INVOCATION_TIMEOUT). Best-effort either way —
    // the manual Sync now button is still a fallback.
    after(() =>
      syncGoogleCalendarConnection(connection.id).catch((error) =>
        console.error('Initial Calendar sync failed:', error)
      )
    )

    // One-time connection bonus — awarded once ever per candidate, not on
    // every reconnect. A genuine reconnect (clearing a real expiry) earns
    // its own smaller one-time bonus instead, per reconnect event — the
    // needsReconnectAt gate above means this only fires once per expiry,
    // not on every incidental hit of this route.
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
    } else if (isGenuineReconnect) {
      const sprint = await getCurrentWeekSprint(profile.id)
      if (sprint) {
        const effort = estimateActionEffort({ actionType: 'CALENDAR_RECONNECTED' })
        await logCatalogAction(profile.id, {
          text: 'Reconnect Calendar after it expired',
          actionType: 'CALENDAR_RECONNECTED',
          points: effort.points,
          estimatedMinutes: effort.minutes,
          recurring: false,
        })
      }
      captureServerEvent(profile.id, 'calendar_reconnected')
    }

    return NextResponse.redirect(new URL(`${returnTo}?calendarConnected=1`, request.url))
  } catch (err) {
    console.error('Calendar OAuth callback failed:', err)
    return NextResponse.redirect(new URL(`${returnTo}?calendarError=exchange_failed`, request.url))
  }
}
