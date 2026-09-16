import 'server-only'
import { prisma } from '@/lib/prisma'
import { getValidAccessToken, getActiveGoogleConnection } from '@/lib/google/connection'
import { listMessagesSince, getMessageHeaders, getMessageBody, getProfileEmail } from '@/lib/google/gmail'
import { listCalendarEvents } from '@/lib/google/admin-calendar'
import { getValidAdminAccessToken } from '@/lib/webinars/admin-calendar-oauth'
import {
  normalizeEmail, displayNameFrom, classifyParticipant, snippetOf, directionOf,
  type SweepContext,
} from './sync-matching'
import type { CalendarAttendee } from '@/lib/google/admin-calendar'

const DAY = 86_400_000

/**
 * Builds the exclusion and matching sets once per sweep.
 *
 * The internal set is the safeguard that makes a full-mailbox sweep
 * acceptable: candidates, coaches and recruiters are product relationships
 * with their own systems of record, so their mail is excluded from logging
 * AND from suggestion rather than filtered out later.
 */
export async function buildSweepContext(selfEmail: string | null): Promise<SweepContext> {
  const [people, candidates, coaches, recruiters] = await Promise.all([
    prisma.crmPerson.findMany({
      where: { OR: [{ email: { not: null } }, { emails: { isEmpty: false } }] },
      select: { id: true, email: true, emails: true },
    }),
    prisma.candidateProfile.findMany({ select: { email: true } }),
    prisma.coach.findMany({ select: { workEmail: true } }),
    prisma.recruiter.findMany({ select: { workEmail: true } }),
  ])

  const crmByEmail = new Map<string, string>()
  for (const p of people) {
    for (const raw of [p.email, ...p.emails]) {
      const e = normalizeEmail(raw)
      if (e && !crmByEmail.has(e)) crmByEmail.set(e, p.id)
    }
  }

  const internalEmails = new Set<string>()
  for (const raw of [
    ...candidates.map((c) => c.email),
    ...coaches.map((c) => c.workEmail),
    ...recruiters.map((r) => r.workEmail),
  ]) {
    const e = normalizeEmail(raw)
    // A person can be both a candidate and a CRM contact — the product
    // relationship wins BY DEFAULT, so a large mailbox of routine candidate
    // mail doesn't flood the suggestion queue. But that default only holds
    // absent a human decision: crmByEmail is left untouched here, so anyone
    // explicitly added to the CRM (classifyParticipant checks 'crm' before
    // 'internal') overrides the exclusion instead of being silently and
    // permanently invisible to it even after being added on purpose.
    if (e) internalEmails.add(e)
  }

  const selfEmails = new Set<string>()
  const self = normalizeEmail(selfEmail)
  if (self) selfEmails.add(self)
  for (const raw of (process.env.ADMIN_EMAILS ?? '').split(',')) {
    const e = normalizeEmail(raw)
    if (e) selfEmails.add(e)
  }

  return { selfEmails, internalEmails, crmByEmail }
}

/** Recomputes the derived touch fields from the activity log. */
export async function refreshTouchFields(personIds: string[]) {
  for (const personId of personIds) {
    const [agg, first, firstInbound] = await Promise.all([
      prisma.crmActivity.aggregate({
        where: { personId, type: { notIn: ['FIELD_CHANGED', 'STAGE_CHANGED'] } },
        _count: { _all: true },
        _max: { occurredAt: true },
      }),
      prisma.crmActivity.findFirst({
        where: { personId, type: { notIn: ['FIELD_CHANGED', 'STAGE_CHANGED'] } },
        orderBy: { occurredAt: 'asc' }, select: { occurredAt: true },
      }),
      prisma.crmActivity.findFirst({
        where: { personId, direction: 'INBOUND', type: { notIn: ['FIELD_CHANGED', 'STAGE_CHANGED'] } },
        orderBy: { occurredAt: 'asc' }, select: { occurredAt: true },
      }),
    ])
    await prisma.crmPerson.update({
      where: { id: personId },
      data: {
        touchCount: agg._count._all,
        lastTouchedAt: agg._max.occurredAt,
        firstTouchedAt: first?.occurredAt ?? null,
        firstRepliedAt: firstInbound?.occurredAt ?? null,
      },
    })
  }
}

export interface SweepResult {
  source: 'gmail' | 'calendar'
  scanned: number
  matched: number
  activitiesCreated: number
  suggested: number
  skippedInternal: number
  reason?: string
}

/**
 * Sweeps recent mail, logging threads that involve a CRM person and proposing
 * frequent correspondents who aren't one yet.
 *
 * Stores participants, subject, direction, timestamp and a ~200 character
 * snippet. Bodies are never fetched — the Gmail request asks for metadata with
 * an explicit header allow-list, so the body does not cross the wire at all.
 *
 * `maxMessages` caps how many messages within the window get fetched, newest
 * first — fine at the default for the nightly cron's short rolling window,
 * but a wide `days` value (a one-time historical backfill) needs it raised
 * explicitly, or the scan silently stops partway through the window and
 * never reaches its older, less-recent mail at all.
 */
export async function sweepGmail(days = 14, maxMessages = 1000): Promise<SweepResult> {
  const base: SweepResult = { source: 'gmail', scanned: 0, matched: 0, activitiesCreated: 0, suggested: 0, skippedInternal: 0 }
  const connection = await getActiveGoogleConnection()
  if (!connection) return { ...base, reason: 'no_connection' }
  const token = await getValidAccessToken()
  if (!token) return { ...base, reason: 'no_token' }

  const windowFrom = new Date(Date.now() - days * DAY)
  const run = await prisma.crmSyncRun.create({ data: { source: 'gmail', windowFrom } })

  try {
    const selfEmail = (await getProfileEmail(token)) ?? connection.email
    const ctx = await buildSweepContext(selfEmail)
    const ids = await listMessagesSince(token, windowFrom, maxMessages)
    const touched = new Set<string>()
    const result = { ...base }

    for (const id of ids) {
      const msg = await getMessageHeaders(token, id)
      if (!msg) continue
      result.scanned++

      const participants = [msg.from, ...msg.to, ...msg.cc]
      const fromEmail = normalizeEmail(msg.from)
      let loggedForThisMessage = false
      let hasInternal = false
      // Fetched at most once per message, and only when a real CRM person is
      // actually on it — every other participant (unknown, internal,
      // automated) never pays for the extra format=full round trip.
      let fullBody: string | null | undefined

      for (const raw of participants) {
        const email = normalizeEmail(raw)
        if (!email) continue
        const verdict = classifyParticipant(email, ctx)

        if (verdict.kind === 'internal') { hasInternal = true; continue }
        if (verdict.kind === 'self' || verdict.kind === 'automated') continue

        if (verdict.kind === 'crm') {
          // A message can involve several CRM people; each gets the activity.
          if (fullBody === undefined) fullBody = await getMessageBody(token, id)
          const created = await prisma.crmActivity.upsert({
            where: { type_sourceRef: { type: 'EMAIL', sourceRef: `${id}:${verdict.personId}` } },
            create: {
              type: 'EMAIL',
              direction: directionOf(fromEmail, ctx),
              occurredAt: msg.internalDate,
              personId: verdict.personId,
              subject: msg.subject,
              // A known CRM contact's mail is worth the real message, not
              // Gmail's ~200-char snippet — falls back to the snippet only if
              // the full-body fetch itself failed (never on an empty body).
              body: fullBody ?? snippetOf(msg.snippet),
              isAutoLogged: true,
              sourceRef: `${id}:${verdict.personId}`,
            },
            update: {},
            select: { createdAt: true },
          })
          // upsert gives no "was created" flag; a fresh row is one written now.
          if (Date.now() - created.createdAt.getTime() < 5_000) result.activitiesCreated++
          touched.add(verdict.personId)
          loggedForThisMessage = true
          continue
        }

        // Unknown human — propose, never create.
        if (verdict.kind === 'unknown') {
          const name = displayNameFrom(raw)
          const prior = await prisma.crmSuggestedContact.findUnique({ where: { email }, select: { status: true } })
          // A dismissed address stays dismissed — re-proposing it every night
          // is how a review queue becomes something you stop opening.
          if (prior?.status === 'IGNORED') continue
          await prisma.crmSuggestedContact.upsert({
            where: { email },
            create: { email, displayName: name, lastSubject: msg.subject, lastSeenAt: msg.internalDate },
            update: {
              messageCount: { increment: 1 },
              lastSeenAt: msg.internalDate,
              lastSubject: msg.subject,
              displayName: name ?? undefined,
            },
          })
          if (!prior) result.suggested++
        }
      }

      if (hasInternal && !loggedForThisMessage) result.skippedInternal++
      if (loggedForThisMessage) result.matched++
    }

    await refreshTouchFields([...touched])
    await prisma.crmSyncRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(), scanned: result.scanned, matched: result.matched,
        activitiesCreated: result.activitiesCreated, suggested: result.suggested,
        skippedInternal: result.skippedInternal,
      },
    })
    return result
  } catch (e) {
    await prisma.crmSyncRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), error: e instanceof Error ? e.message : String(e) },
    })
    throw e
  }
}

/**
 * Logs meetings whose attendees include a CRM person, and proposes attendees
 * who aren't one yet — mirroring sweepGmail's propose-don't-create rule.
 *
 * A future event is still scanned for attendees (so "meeting Omer tomorrow"
 * surfaces him today), just not logged as a completed MEETING — only the
 * activity write is gated on `ev.start` being in the past, not the scan.
 */
export async function sweepCalendar(daysBack = 14, daysForward = 1): Promise<SweepResult> {
  const base: SweepResult = { source: 'calendar', scanned: 0, matched: 0, activitiesCreated: 0, suggested: 0, skippedInternal: 0 }
  // getValidAdminAccessToken throws when no calendar is connected; an
  // unconnected calendar is "nothing to sweep", not an error worth failing on.
  let token: string
  try {
    token = await getValidAdminAccessToken()
  } catch {
    return { ...base, reason: 'no_connection' }
  }

  const windowFrom = new Date(Date.now() - daysBack * DAY)
  const run = await prisma.crmSyncRun.create({ data: { source: 'calendar', windowFrom } })

  try {
    const ctx = await buildSweepContext(null)
    const events = await listCalendarEvents(token, windowFrom, new Date(Date.now() + daysForward * DAY))
    const touched = new Set<string>()
    const result = { ...base }

    const attendeeName = (a: CalendarAttendee) => a.displayName || displayNameFrom(a.email)

    for (const ev of events) {
      result.scanned++
      const isPast = ev.start.getTime() <= Date.now()
      let logged = false
      let hasInternal = false

      for (const a of ev.attendees) {
        if (!a.email) continue
        const verdict = classifyParticipant(a.email, ctx)
        if (verdict.kind === 'internal') { hasInternal = true; continue }
        if (verdict.kind === 'self' || verdict.kind === 'automated') continue

        if (verdict.kind === 'crm') {
          // Nothing to log yet for a meeting that hasn't happened.
          if (!isPast) continue
          const created = await prisma.crmActivity.upsert({
            where: { type_sourceRef: { type: 'MEETING', sourceRef: `${ev.id}:${verdict.personId}` } },
            create: {
              type: 'MEETING', direction: 'OUTBOUND', occurredAt: ev.start,
              personId: verdict.personId, subject: ev.summary ?? 'Meeting',
              isAutoLogged: true, sourceRef: `${ev.id}:${verdict.personId}`,
            },
            update: {},
            select: { createdAt: true },
          })
          if (Date.now() - created.createdAt.getTime() < 5_000) result.activitiesCreated++
          touched.add(verdict.personId)
          logged = true
          continue
        }

        // Unknown attendee — propose regardless of whether the meeting is
        // past or upcoming, so a suggestion arrives before the meeting does.
        if (verdict.kind === 'unknown') {
          const name = attendeeName(a)
          const prior = await prisma.crmSuggestedContact.findUnique({ where: { email: a.email }, select: { status: true } })
          if (prior?.status === 'IGNORED') continue
          await prisma.crmSuggestedContact.upsert({
            where: { email: a.email },
            create: { email: a.email, displayName: name, lastSubject: ev.summary, lastSeenAt: ev.start },
            update: {
              messageCount: { increment: 1 },
              lastSeenAt: ev.start,
              lastSubject: ev.summary ?? undefined,
              displayName: name ?? undefined,
            },
          })
          if (!prior) result.suggested++
        }
      }

      if (hasInternal && !logged) result.skippedInternal++
      if (logged) result.matched++
    }

    await refreshTouchFields([...touched])
    await prisma.crmSyncRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(), scanned: result.scanned, matched: result.matched,
        activitiesCreated: result.activitiesCreated, suggested: result.suggested,
        skippedInternal: result.skippedInternal,
      },
    })
    return result
  } catch (e) {
    await prisma.crmSyncRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), error: e instanceof Error ? e.message : String(e) },
    })
    throw e
  }
}
