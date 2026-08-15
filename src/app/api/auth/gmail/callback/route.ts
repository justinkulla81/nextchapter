import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { exchangeCodeForTokens, isGmailTrackingTester, fetchGoogleAccountEmail } from '@/lib/email-tracking/gmail-oauth'
import { syncGmailConnection } from '@/lib/email-tracking/sync-gmail'
import { prisma } from '@/lib/prisma'
import { getCurrentWeekSprint, logCatalogAction } from '@/lib/weekly/sprint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { captureServerEvent } from '@/lib/posthog/server'
import { looksLikeCorporateDomain } from '@/lib/text/email-domain'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.redirect(new URL('/dashboard/network?gmailError=not_logged_in', request.url))
  }
  // Second layer of the hard gate — checked again here, not just at /start,
  // since this route is independently reachable.
  if (!(await isGmailTrackingTester(user.email))) {
    return NextResponse.redirect(new URL('/dashboard/network?gmailError=not_a_tester', request.url))
  }

  const code = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')
  if (error || !code) {
    return NextResponse.redirect(new URL('/dashboard/network?gmailError=denied', request.url))
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    if (!tokens.refresh_token) {
      return NextResponse.redirect(new URL('/dashboard/network?gmailError=no_refresh_token', request.url))
    }

    const profile = await getOrCreateCandidateProfile(user.id)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    // §4.6 hard block — "Use a personal account. We'll only connect a
    // personal account while Confidential Search Mode is on." Checked
    // BEFORE the connection is ever created or updated, so a blocked
    // attempt leaves no EmailConnection row and no tokens stored anywhere.
    const connectedEmail = await fetchGoogleAccountEmail(tokens.access_token)
    if (profile.confidentialSearchMode && connectedEmail && looksLikeCorporateDomain(connectedEmail)) {
      captureServerEvent(profile.id, 'gmail_connect_blocked_corporate_domain')
      return NextResponse.redirect(new URL('/dashboard/network?gmailError=corporate_domain_blocked', request.url))
    }

    // Upsert rather than create — a reconnect after a prior disconnect
    // reuses the same row (candidateId is unique) instead of erroring.
    const existing = await prisma.emailConnection.findUnique({ where: { candidateId: profile.id } })
    const isFirstEverConnection = !existing
    // Captured before the upsert clears it — true only when this callback
    // is genuinely completing a reconnect of an expired connection, not an
    // incidental re-hit of this route on an already-healthy connection.
    const isGenuineReconnect = !!existing?.needsReconnectAt

    const connection = await prisma.emailConnection.upsert({
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
    })

    // Run the first sync immediately rather than waiting for the candidate
    // to separately discover and click "Sync now" on the Email Activity
    // page — best-effort, since the manual button is still a fallback.
    await syncGmailConnection(connection.id).catch((error) => console.error('Initial Gmail sync failed:', error))

    // One-time connection bonus — awarded once ever per candidate, not on
    // every reconnect. A genuine reconnect (clearing a real expiry) earns
    // its own smaller one-time bonus instead, per reconnect event — the
    // needsReconnectAt gate above means this only fires once per expiry,
    // not on every incidental hit of this route.
    if (isFirstEverConnection) {
      const sprint = await getCurrentWeekSprint(profile.id)
      if (sprint) {
        const effort = estimateActionEffort({ actionType: 'GMAIL_CONNECTED' })
        await logCatalogAction(profile.id, {
          text: 'Connected your Gmail so activity counts automatically',
          actionType: 'GMAIL_CONNECTED',
          points: effort.points,
          estimatedMinutes: effort.minutes,
          recurring: false,
        })
      }
      captureServerEvent(profile.id, 'gmail_connected')
    } else if (isGenuineReconnect) {
      const sprint = await getCurrentWeekSprint(profile.id)
      if (sprint) {
        const effort = estimateActionEffort({ actionType: 'GMAIL_RECONNECTED' })
        await logCatalogAction(profile.id, {
          text: 'Reconnect Gmail after it expired',
          actionType: 'GMAIL_RECONNECTED',
          points: effort.points,
          estimatedMinutes: effort.minutes,
          recurring: false,
        })
      }
      captureServerEvent(profile.id, 'gmail_reconnected')
    }

    return NextResponse.redirect(new URL('/dashboard/network?gmailConnected=1', request.url))
  } catch (err) {
    console.error('Gmail OAuth callback failed:', err)
    return NextResponse.redirect(new URL('/dashboard/network?gmailError=exchange_failed', request.url))
  }
}
