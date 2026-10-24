import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { coachGoogleEnabled } from '@/lib/coach/google/config'
import { CoachRefreshError, refreshCoachAccessToken, revokeCoachToken, type CoachTokenResponse } from '@/lib/coach/google/oauth'

/**
 * Why a call to the coach's calendar could not run.
 * off: the feature is not switched on. not_connected: this coach never connected. disconnected: access was lost or removed,
 * so new bookings pause. transient: Google or the network failed this time; nothing is disconnected.
 */
export class CoachGoogleError extends Error {
  constructor(
    readonly kind: 'off' | 'not_connected' | 'disconnected' | 'transient',
    message: string
  ) {
    super(message)
    this.name = 'CoachGoogleError'
  }
}

export type DisconnectReason = 'coach' | 'revoked' | 'permission'

export type CoachGoogleStatus =
  | { feature: 'off' }
  | { feature: 'on'; state: 'none' }
  | { feature: 'on'; state: 'connected'; email: string; connectedAt: Date; lastCheckedAt: Date | null; calendarIds: string[] }
  | { feature: 'on'; state: 'disconnected'; email: string; disconnectedAt: Date | null; reason: string | null; calendarIds: string[] }

/** Fail-soft read for pages: a missing table (SQL not applied yet) reads as "no connection", never a crash. */
export async function getCoachGoogleStatus(coachId: string): Promise<CoachGoogleStatus> {
  if (!coachGoogleEnabled()) return { feature: 'off' }
  try {
    const row = await prisma.coachGoogleConnection.findUnique({ where: { coachId } })
    if (!row) return { feature: 'on', state: 'none' }
    const calendarIds = row.conflictCalendarIds.length > 0 ? row.conflictCalendarIds : ['primary']
    if (row.status === 'connected') {
      return { feature: 'on', state: 'connected', email: row.googleEmail, connectedAt: row.connectedAt, lastCheckedAt: row.lastCheckedAt, calendarIds }
    }
    return { feature: 'on', state: 'disconnected', email: row.googleEmail, disconnectedAt: row.disconnectedAt, reason: row.disconnectReason, calendarIds }
  } catch (error) {
    console.error('Coach Google status unavailable:', error)
    return { feature: 'on', state: 'none' }
  }
}

export async function saveCoachConnection(input: { coachId: string; email: string; tokens: CoachTokenResponse & { refresh_token: string } }): Promise<void> {
  const expiresAt = new Date(Date.now() + input.tokens.expires_in * 1000)
  const existing = await prisma.coachGoogleConnection.findUnique({ where: { coachId: input.coachId }, select: { googleEmail: true, conflictCalendarIds: true } })
  // The same account reconnecting keeps the calendars the coach picked; a different account starts from its primary calendar.
  const keepCalendars = existing && existing.googleEmail.toLowerCase() === input.email.toLowerCase() && existing.conflictCalendarIds.length > 0
  const data = {
    googleEmail: input.email,
    accessToken: input.tokens.access_token,
    refreshToken: input.tokens.refresh_token,
    expiresAt,
    status: 'connected',
    disconnectReason: null,
    disconnectedAt: null,
    lastCheckedAt: new Date(),
    connectedAt: new Date(),
    conflictCalendarIds: keepCalendars ? existing.conflictCalendarIds : ['primary'],
  }
  await prisma.coachGoogleConnection.upsert({ where: { coachId: input.coachId }, create: { coachId: input.coachId, ...data }, update: data })
}

/** Marks the connection disconnected and drops the tokens. Existing events and bookings are left alone. */
export async function markCoachDisconnected(coachId: string, reason: DisconnectReason): Promise<void> {
  try {
    await prisma.coachGoogleConnection.updateMany({
      where: { coachId, status: 'connected' },
      data: { status: 'disconnected', disconnectReason: reason, disconnectedAt: new Date(), accessToken: '', refreshToken: '' },
    })
    captureServerEvent(coachId, 'coach_google_disconnected', { coachId, reason })
  } catch (error) {
    console.error(`Could not mark coach ${coachId} Google connection as disconnected:`, error)
  }
}

/** The coach chose to disconnect: tell Google to drop the grant, then mark it. Booked sessions keep their Meet links. */
export async function disconnectCoachGoogle(coachId: string): Promise<void> {
  const row = await prisma.coachGoogleConnection.findUnique({ where: { coachId }, select: { refreshToken: true, accessToken: true, status: true } })
  if (!row) return
  if (row.status === 'connected') await revokeCoachToken(row.refreshToken || row.accessToken)
  await markCoachDisconnected(coachId, 'coach')
}

/**
 * A valid access token for the coach's own calendar, refreshing it when it is about to expire.
 * Throws CoachGoogleError. A refresh Google rejects as invalid_grant marks the coach disconnected (so new bookings pause and
 * the reconnect banner shows); any other failure is transient and changes nothing.
 */
export async function getCoachAccessToken(coachId: string, opts: { force?: boolean } = {}): Promise<{ accessToken: string; calendarIds: string[] }> {
  if (!coachGoogleEnabled()) throw new CoachGoogleError('off', 'Coach Google Calendar is not switched on.')
  const row = await prisma.coachGoogleConnection.findUnique({ where: { coachId } })
  if (!row) throw new CoachGoogleError('not_connected', 'This coach has not connected Google Calendar.')
  if (row.status !== 'connected' || !row.refreshToken) throw new CoachGoogleError('disconnected', 'This coach’s Google Calendar needs reconnecting.')
  const calendarIds = row.conflictCalendarIds.length > 0 ? row.conflictCalendarIds : ['primary']

  if (!opts.force && row.accessToken && row.expiresAt.getTime() > Date.now() + 60_000) return { accessToken: row.accessToken, calendarIds }

  try {
    const refreshed = await refreshCoachAccessToken(row.refreshToken)
    await prisma.coachGoogleConnection.update({
      where: { coachId },
      data: { accessToken: refreshed.access_token, expiresAt: new Date(Date.now() + refreshed.expires_in * 1000), lastCheckedAt: new Date() },
    })
    return { accessToken: refreshed.access_token, calendarIds }
  } catch (error) {
    if (error instanceof CoachRefreshError && error.kind === 'revoked') {
      await markCoachDisconnected(coachId, 'revoked')
      throw new CoachGoogleError('disconnected', 'Google no longer lets us reach this coach’s calendar.')
    }
    throw new CoachGoogleError('transient', 'Could not reach Google just now.')
  }
}

/**
 * Runs one Google Calendar request as the coach. A 401 gets one forced refresh and a retry; a 403 that says the grant lacks
 * permission marks the coach disconnected. The caller gets the final Response and decides what the status means for it.
 */
export async function coachGoogleFetch(coachId: string, run: (accessToken: string, calendarIds: string[]) => Promise<Response>): Promise<Response> {
  let { accessToken, calendarIds } = await getCoachAccessToken(coachId)
  let response: Response
  try {
    response = await run(accessToken, calendarIds)
    if (response.status === 401) {
      ;({ accessToken, calendarIds } = await getCoachAccessToken(coachId, { force: true }))
      response = await run(accessToken, calendarIds)
    }
  } catch (error) {
    if (error instanceof CoachGoogleError) throw error
    throw new CoachGoogleError('transient', 'Could not reach Google just now.')
  }
  if (response.status === 403) {
    const body = await response.clone().text().catch(() => '')
    if (/ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficientPermissions|PERMISSION_DENIED/.test(body)) {
      await markCoachDisconnected(coachId, 'permission')
      throw new CoachGoogleError('disconnected', 'The coach removed a calendar permission.')
    }
  }
  if (response.ok) {
    // Cheap proof the connection still works, shown as "last checked" on the settings page. Not worth failing a booking over.
    prisma.coachGoogleConnection.update({ where: { coachId }, data: { lastCheckedAt: new Date() } }).catch(() => {})
  }
  return response
}

export async function setConflictCalendars(coachId: string, ids: string[]): Promise<void> {
  const unique = [...new Set(ids)]
  await prisma.coachGoogleConnection.update({ where: { coachId }, data: { conflictCalendarIds: unique.length > 0 ? unique : ['primary'] } })
}
