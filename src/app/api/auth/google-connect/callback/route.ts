import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import {
  exchangeCodeForTokens,
  getCombinedRedirectUri,
  isGmailTrackingTester,
  fetchGoogleAccountEmail,
} from '@/lib/email-tracking/gmail-oauth'
import { syncGmailConnection } from '@/lib/email-tracking/sync-gmail'
import { syncGoogleCalendarConnection } from '@/lib/calendar-tracking/sync-google-calendar'
import { prisma } from '@/lib/prisma'
import { getCurrentWeekSprint, logCatalogAction } from '@/lib/weekly/sprint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { captureServerEvent } from '@/lib/posthog/server'
import { looksLikeCorporateDomain } from '@/lib/text/email-domain'

// One token exchange grants both the Gmail and Calendar scopes (requested
// together in buildCombinedGoogleAuthUrl), so this upserts both connection
// rows and awards both one-time bonuses from the single callback — the
// candidate only goes through Google's consent screen once.
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.redirect(new URL('/dashboard/network?gmailError=not_logged_in', request.url))
  }
  if (!(await isGmailTrackingTester(user.email))) {
    return NextResponse.redirect(new URL('/dashboard/network?gmailError=not_a_tester', request.url))
  }

  const code = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')
  if (error || !code) {
    return NextResponse.redirect(new URL('/dashboard/network?gmailError=denied', request.url))
  }

  try {
    const tokens = await exchangeCodeForTokens(code, getCombinedRedirectUri())
    if (!tokens.refresh_token) {
      return NextResponse.redirect(new URL('/dashboard/network?gmailError=no_refresh_token', request.url))
    }

    const profile = await getOrCreateCandidateProfile(user.id)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    // §4.6 hard block — same check as the Gmail-only callback, before
    // anything is written. This combined flow also grants Calendar access,
    // but the block is keyed on the same "personal account only" rule.
    const connectedEmail = await fetchGoogleAccountEmail(tokens.access_token)
    if (profile.confidentialSearchMode && connectedEmail && looksLikeCorporateDomain(connectedEmail)) {
      captureServerEvent(profile.id, 'google_connect_blocked_corporate_domain')
      return NextResponse.redirect(new URL('/dashboard/network?gmailError=corporate_domain_blocked', request.url))
    }

    const [existingEmail, existingCalendar] = await Promise.all([
      prisma.emailConnection.findUnique({ where: { candidateId: profile.id } }),
      prisma.calendarConnection.findUnique({ where: { candidateId: profile.id } }),
    ])

    const [emailConnection, calendarConnection] = await Promise.all([
      prisma.emailConnection.upsert({
        where: { candidateId: profile.id },
        create: {
          candidateId: profile.id,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt,
          connectedEmail,
        },
        update: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt,
          disconnectedAt: null,
          needsReconnectAt: null,
          connectedEmail,
        },
      }),
      prisma.calendarConnection.upsert({
        where: { candidateId: profile.id },
        create: { candidateId: profile.id, accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt },
        update: { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt, disconnectedAt: null, needsReconnectAt: null },
      }),
    ])

    // Run the first sync immediately rather than waiting for the candidate
    // to separately discover and click "Sync now" — otherwise a fresh
    // connection looks like it did nothing until that extra step happens.
    // Best-effort: a sync failure here shouldn't block the connection itself
    // from completing, since the manual Sync now button is still a fallback.
    await Promise.all([
      syncGmailConnection(emailConnection.id).catch((error) => console.error('Initial Gmail sync failed:', error)),
      syncGoogleCalendarConnection(calendarConnection.id).catch((error) =>
        console.error('Initial Calendar sync failed:', error)
      ),
    ])

    const sprint = await getCurrentWeekSprint(profile.id)
    if (sprint) {
      if (!existingEmail) {
        const effort = estimateActionEffort({ actionType: 'GMAIL_CONNECTED' })
        await logCatalogAction(profile.id, {
          text: 'Connected your Gmail so activity counts automatically',
          actionType: 'GMAIL_CONNECTED',
          points: effort.points,
          estimatedMinutes: effort.minutes,
          recurring: false,
        })
      } else if (existingEmail.needsReconnectAt) {
        const effort = estimateActionEffort({ actionType: 'GMAIL_RECONNECTED' })
        await logCatalogAction(profile.id, {
          text: 'Reconnect Gmail after it expired',
          actionType: 'GMAIL_RECONNECTED',
          points: effort.points,
          estimatedMinutes: effort.minutes,
          recurring: false,
        })
      }
      if (!existingCalendar) {
        const effort = estimateActionEffort({ actionType: 'CALENDAR_CONNECTED' })
        await logCatalogAction(profile.id, {
          text: 'Connected your calendar so interviews and calls count automatically',
          actionType: 'CALENDAR_CONNECTED',
          points: effort.points,
          estimatedMinutes: effort.minutes,
          recurring: false,
        })
      } else if (existingCalendar.needsReconnectAt) {
        const effort = estimateActionEffort({ actionType: 'CALENDAR_RECONNECTED' })
        await logCatalogAction(profile.id, {
          text: 'Reconnect Calendar after it expired',
          actionType: 'CALENDAR_RECONNECTED',
          points: effort.points,
          estimatedMinutes: effort.minutes,
          recurring: false,
        })
      }
    }
    captureServerEvent(profile.id, existingEmail && existingCalendar ? 'google_reconnected' : 'google_connected')

    return NextResponse.redirect(new URL('/dashboard/network?gmailConnected=1&calendarConnected=1', request.url))
  } catch (err) {
    console.error('Combined Google OAuth callback failed:', err)
    return NextResponse.redirect(new URL('/dashboard/network?gmailError=exchange_failed', request.url))
  }
}
