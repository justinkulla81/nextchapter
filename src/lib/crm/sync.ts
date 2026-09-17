import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getValidAccessToken, getActiveGoogleConnection } from '@/lib/google/connection'
import { listMessagesSince, listMessagesForAddress, getMessageHeaders, getMessageBody, getProfileEmail } from '@/lib/google/gmail'
import { listCalendarEvents } from '@/lib/google/admin-calendar'
import { getValidAdminAccessToken } from '@/lib/webinars/admin-calendar-oauth'
import {
  normalizeEmail, displayNameFrom, classifyParticipant, snippetOf, directionOf,
  type SweepContext,
} from './sync-matching'
import type { CalendarAttendee } from '@/lib/google/admin-calendar'
import { isPlaceholderName } from '@/lib/resume/placeholder-name'
import { looksLikeNotAPerson } from './person-plausibility'
import { CRM_ACTIVITY_CUTOFF, isAfterCrmCutoff } from './cutoff'

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

/**
 * Recomputes the derived touch fields from the activity log.
 *
 * Scoped to real interactions since CRM_ACTIVITY_CUTOFF: field and stage
 * changes are bookkeeping rather than contact, and anything predating the
 * company is not outreach. Applied here as well as at the write, so a row
 * already sitting in the table from before the rule existed cannot keep
 * inflating a touch count.
 */
export const REAL_TOUCH: Prisma.CrmActivityWhereInput = {
  type: { notIn: ['FIELD_CHANGED', 'STAGE_CHANGED'] },
  occurredAt: { gte: CRM_ACTIVITY_CUTOFF },
}

export async function refreshTouchFields(personIds: string[]) {
  for (const personId of personIds) {
    const [agg, first, firstInbound, lastActivity] = await Promise.all([
      prisma.crmActivity.aggregate({
        where: { personId, ...REAL_TOUCH },
        _count: { _all: true },
        _max: { occurredAt: true },
      }),
      prisma.crmActivity.findFirst({
        where: { personId, ...REAL_TOUCH },
        orderBy: { occurredAt: 'asc' }, select: { occurredAt: true },
      }),
      prisma.crmActivity.findFirst({
        where: { personId, direction: 'INBOUND', ...REAL_TOUCH },
        orderBy: { occurredAt: 'asc' }, select: { occurredAt: true },
      }),
      // Whichever real activity happened most recently, regardless of
      // direction — if it's ours, we're the last one to have spoken and are
      // waiting on them.
      prisma.crmActivity.findFirst({
        where: { personId, ...REAL_TOUCH },
        orderBy: { occurredAt: 'desc' }, select: { occurredAt: true, direction: true },
      }),
    ])
    await prisma.crmPerson.update({
      where: { id: personId },
      data: {
        touchCount: agg._count._all,
        lastTouchedAt: agg._max.occurredAt,
        firstTouchedAt: first?.occurredAt ?? null,
        firstRepliedAt: firstInbound?.occurredAt ?? null,
        awaitingReplySince: lastActivity?.direction === 'OUTBOUND' ? lastActivity.occurredAt : null,
      },
    })
  }
}

/**
 * Finds or creates the CrmPerson for an email the sweep doesn't already
 * recognize — everyone the sweep finds becomes a real record now, flagged
 * `needsCompletion` so the Needs Completion queue is the one place to
 * review, merge, or discard them, rather than a separate approval queue
 * nothing else in the CRM understands.
 *
 * A PREVIOUSLY DELETED person stays excluded rather than quietly getting a
 * new activity logged against their hidden row — deleting someone from
 * Needs Completion is a decision ("not a real lead", "not who I meant"),
 * and a future sweep re-adding them, even invisibly, would silently
 * overturn it. Returns null in that case; the caller should skip the
 * participant entirely, same as an internal or automated address.
 *
 * `cache` is per-sweep-run: the same address can appear on many messages/
 * events in one run, and only the first occurrence should hit the database.
 */
async function getOrCreatePerson(
  email: string, rawName: string | null, cache: Map<string, string | null>
): Promise<{ id: string; created: boolean } | null> {
  if (cache.has(email)) {
    const id = cache.get(email)!
    return id ? { id, created: false } : null
  }

  const existing = await prisma.crmPerson.findFirst({ where: { email }, select: { id: true, deletedAt: true } })
  if (existing) {
    cache.set(email, existing.deletedAt ? null : existing.id)
    return existing.deletedAt ? null : { id: existing.id, created: false }
  }

  const name = rawName && !isPlaceholderName(rawName) ? rawName : null
  const fullName = name ?? email.split('@')[0]

  // Same detector Needs Completion uses to flag an existing row — applied
  // here too so "CVS Pharmacy" or "Manhattan Soccer Club" never becomes a
  // row to flag in the first place. isAutomatedAddress already caught most
  // of these upstream in classifyParticipant; this is the name-based half
  // of that same check, for the rarer case of a plausible-looking email
  // paired with an obviously-not-a-person display name.
  if (looksLikeNotAPerson(fullName, email)) {
    cache.set(email, null)
    return null
  }

  const created = await prisma.crmPerson.create({
    data: {
      fullName,
      firstName: name?.split(' ')[0] ?? null,
      lastName: name?.split(' ').slice(1).join(' ') || null,
      // Every row created here already has a real email (the sweep's only
      // input) — a real, reachable contact worth a baseline follow-up by
      // default rather than sitting unprioritized.
      email, emails: [email], needsCompletion: true, roles: [], priority: 'P2',
    },
  })
  cache.set(email, created.id)
  return { id: created.id, created: true }
}

export interface SweepResult {
  source: 'gmail' | 'calendar'
  scanned: number
  matched: number
  activitiesCreated: number
  /** New CrmPerson rows created for an address the sweep didn't recognize. */
  suggested: number
  skippedInternal: number
  reason?: string
}

/**
 * Sweeps recent mail, logging threads that involve a CRM person — an
 * unrecognized correspondent is now created as a real person (flagged
 * `needsCompletion`) rather than parked in a separate suggestion queue, so
 * there's one review surface for everyone the sweep finds, not two systems.
 *
 * Bodies are only fetched for a message once a real person is on it — see
 * getMessageBody's own comment; every other message pays only for the
 * existing metadata-only fetch.
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

  // The rolling window never reaches back past the cutoff, however wide a
  // `days` a manual backfill passes.
  const rollingFrom = new Date(Date.now() - days * DAY)
  const windowFrom = rollingFrom < CRM_ACTIVITY_CUTOFF ? CRM_ACTIVITY_CUTOFF : rollingFrom
  const run = await prisma.crmSyncRun.create({ data: { source: 'gmail', windowFrom } })

  try {
    const selfEmail = (await getProfileEmail(token)) ?? connection.email
    const ctx = await buildSweepContext(selfEmail)
    const ids = await listMessagesSince(token, windowFrom, maxMessages)
    const touched = new Set<string>()
    const personCache = new Map<string, string | null>()
    const result = { ...base }

    for (const id of ids) {
      const msg = await getMessageHeaders(token, id)
      if (!msg) continue
      // Belt and braces: the query already asked for nothing older, but a
      // message's internalDate is the thing the activity is dated by.
      if (!isAfterCrmCutoff(msg.internalDate)) continue
      result.scanned++

      const participants = [msg.from, ...msg.to, ...msg.cc]
      const fromEmail = normalizeEmail(msg.from)
      let loggedForThisMessage = false
      let hasInternal = false
      // Fetched at most once per message, and only once a real (or
      // newly-created) person is actually on it — every purely internal or
      // automated message never pays for the extra format=full round trip.
      let fullBody: string | null | undefined

      for (const raw of participants) {
        const email = normalizeEmail(raw)
        if (!email) continue
        const verdict = classifyParticipant(email, ctx)

        if (verdict.kind === 'internal') { hasInternal = true; continue }
        if (verdict.kind === 'self' || verdict.kind === 'automated') continue

        let personId: string
        let isNewPerson = false
        if (verdict.kind === 'crm') {
          personId = verdict.personId
        } else {
          const resolved = await getOrCreatePerson(email, displayNameFrom(raw), personCache)
          if (!resolved) continue // deleted before — stays excluded, not silently re-added
          personId = resolved.id
          isNewPerson = resolved.created
        }

        // A message can involve several such people; each gets the activity.
        if (fullBody === undefined) fullBody = await getMessageBody(token, id)
        const created = await prisma.crmActivity.upsert({
          where: { type_sourceRef: { type: 'EMAIL', sourceRef: `${id}:${personId}` } },
          create: {
            type: 'EMAIL',
            direction: directionOf(fromEmail, ctx),
            occurredAt: msg.internalDate,
            personId,
            subject: msg.subject,
            // A known CRM contact's mail is worth the real message, not
            // Gmail's ~200-char snippet — falls back to the snippet only if
            // the full-body fetch itself failed (never on an empty body).
            body: fullBody ?? snippetOf(msg.snippet),
            isAutoLogged: true,
            sourceRef: `${id}:${personId}`,
          },
          update: {},
          select: { createdAt: true },
        })
        // upsert gives no "was created" flag; a fresh row is one written now.
        if (Date.now() - created.createdAt.getTime() < 5_000) result.activitiesCreated++
        if (isNewPerson) result.suggested++
        touched.add(personId)
        loggedForThisMessage = true
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
 * Logs meetings whose attendees include a CRM person — an unrecognized
 * attendee is created as a real person immediately (flagged
 * `needsCompletion`), same as sweepGmail, so "meeting Omer tomorrow" adds
 * Omer today rather than waiting on a separate approval step.
 *
 * A future event is still scanned for attendees (so that meeting adds him
 * today), just not logged as a completed MEETING — only the activity write
 * is gated on `ev.start` being in the past, not the scan or the person
 * creation.
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

  const rollingFrom = new Date(Date.now() - daysBack * DAY)
  const windowFrom = rollingFrom < CRM_ACTIVITY_CUTOFF ? CRM_ACTIVITY_CUTOFF : rollingFrom
  const run = await prisma.crmSyncRun.create({ data: { source: 'calendar', windowFrom } })

  try {
    const ctx = await buildSweepContext(null)
    const events = await listCalendarEvents(token, windowFrom, new Date(Date.now() + daysForward * DAY))
    const touched = new Set<string>()
    const personCache = new Map<string, string | null>()
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

        let personId: string
        let isNewPerson = false
        if (verdict.kind === 'crm') {
          personId = verdict.personId
        } else {
          const resolved = await getOrCreatePerson(a.email, attendeeName(a), personCache)
          if (!resolved) continue // deleted before — stays excluded, not silently re-added
          personId = resolved.id
          isNewPerson = resolved.created
        }
        if (isNewPerson) result.suggested++

        // Nothing to log yet for a meeting that hasn't happened — the person
        // itself is still created above so they're findable before then.
        // A meeting older than the cutoff is the same case in reverse: the
        // attendee is still worth having, the meeting is not an interaction.
        if (!isPast || !isAfterCrmCutoff(ev.start)) continue

        const created = await prisma.crmActivity.upsert({
          where: { type_sourceRef: { type: 'MEETING', sourceRef: `${ev.id}:${personId}` } },
          create: {
            type: 'MEETING', direction: 'OUTBOUND', occurredAt: ev.start,
            personId, subject: ev.summary ?? 'Meeting',
            isAutoLogged: true, sourceRef: `${ev.id}:${personId}`,
          },
          update: {},
          select: { createdAt: true },
        })
        if (Date.now() - created.createdAt.getTime() < 5_000) result.activitiesCreated++
        touched.add(personId)
        logged = true
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

export interface PersonBackfillResult {
  found: number
  oldestAt: Date | null
  reason?: 'no_connection' | 'no_token' | 'invalid_email' | 'person_deleted'
}

/**
 * On-demand, single-person history check — triggered from the "do you have
 * their email?" prompt, not the nightly sweep.
 *
 * Narrower than sweepGmail in the ways that matter for a one-off,
 * human-initiated action: it reaches past the sweep's rolling lookback
 * (bounded only by CRM_ACTIVITY_CUTOFF), creates no new people for the
 * other participants on a thread (you already know who this is), and logs
 * every found message straight to `personId` rather than reclassifying it.
 * Upserts on the same `${id}:${personId}` key sweepGmail uses, so a later
 * nightly sweep re-finding the same message updates nothing instead of
 * double-logging it.
 *
 * The refresh at the end runs in a `finally`. It used to be the last line
 * of a loop that could take longer than the request it runs inside: the
 * mail landed, the function was killed, and the person was left with real
 * correspondence logged and a touch count of zero — reading "never
 * contacted" on a record whose history was sitting right there. The cutoff
 * makes that far less likely by shrinking the work; the `finally` makes a
 * partial run self-consistent rather than silently wrong.
 */
export async function backfillPersonFromEmail(
  personId: string,
  rawEmail: string,
  // Capped low on purpose: this runs inside the request that a human is
  // waiting on, and each message costs two more Gmail round trips. Since the
  // cutoff, even a chatty thread is a few dozen messages — a cap this size
  // is the difference between a slow save and a request that dies.
  maxMessages = 60,
): Promise<PersonBackfillResult> {
  const email = normalizeEmail(rawEmail)
  if (!email) return { found: 0, oldestAt: null, reason: 'invalid_email' }

  // getOrCreatePerson already refuses to log new activity against a
  // soft-deleted person (see its own comment) — this direct-by-id entry
  // point bypasses that lookup entirely, so it needs the same guard, or a
  // stale personId (a duplicate merged away after the caller loaded the
  // page) silently resurrects real data onto a hidden row instead of the
  // live one the CRM actually shows.
  const target = await prisma.crmPerson.findUnique({ where: { id: personId }, select: { deletedAt: true } })
  if (!target || target.deletedAt) return { found: 0, oldestAt: null, reason: 'person_deleted' }

  const connection = await getActiveGoogleConnection()
  if (!connection) return { found: 0, oldestAt: null, reason: 'no_connection' }
  const token = await getValidAccessToken()
  if (!token) return { found: 0, oldestAt: null, reason: 'no_token' }

  const selfEmail = normalizeEmail((await getProfileEmail(token)) ?? connection.email)
  const ctx: SweepContext = {
    selfEmails: new Set(selfEmail ? [selfEmail] : []),
    internalEmails: new Set(),
    crmByEmail: new Map(),
  }

  const ids = await listMessagesForAddress(token, email, CRM_ACTIVITY_CUTOFF, maxMessages)
  let found = 0
  let oldestAt: Date | null = null

  try {
    for (const id of ids) {
      const msg = await getMessageHeaders(token, id)
      if (!msg) continue
      if (!isAfterCrmCutoff(msg.internalDate)) continue
      const fromEmail = normalizeEmail(msg.from)
      const fullBody = await getMessageBody(token, id)
      await prisma.crmActivity.upsert({
        where: { type_sourceRef: { type: 'EMAIL', sourceRef: `${id}:${personId}` } },
        create: {
          type: 'EMAIL',
          direction: directionOf(fromEmail, ctx),
          occurredAt: msg.internalDate,
          personId,
          subject: msg.subject,
          body: fullBody ?? snippetOf(msg.snippet),
          isAutoLogged: true,
          sourceRef: `${id}:${personId}`,
        },
        update: {},
      })
      found++
      if (!oldestAt || msg.internalDate < oldestAt) oldestAt = msg.internalDate
    }
  } finally {
    // Always — a run cut short still has to leave the person's derived
    // fields agreeing with the activity rows it did manage to write.
    await refreshTouchFields([personId])
  }
  return { found, oldestAt }
}
