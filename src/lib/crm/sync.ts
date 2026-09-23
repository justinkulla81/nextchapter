import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getValidAccessToken, getActiveGoogleConnection } from '@/lib/google/connection'
import { listMessagesSince, listMessagesForAddress, getMessageHeaders, getMessageBody, getProfileEmail, getSendAsAddresses } from '@/lib/google/gmail'
import { listCalendarEvents } from '@/lib/google/admin-calendar'
import { getValidAdminAccessToken } from '@/lib/webinars/admin-calendar-oauth'
import {
  normalizeEmail, displayNameFrom, classifyParticipant, snippetOf, directionOf, mentionsNextChapter,
  type SweepContext,
} from './sync-matching'
import type { CalendarAttendee } from '@/lib/google/admin-calendar'
import { isPlaceholderName } from '@/lib/resume/placeholder-name'
import { looksLikeNotAPerson } from './person-plausibility'
import { CRM_ACTIVITY_CUTOFF, isAfterCrmCutoff } from './cutoff'
import { canonicalEmail, findEmailOwner } from './email-owner'

const DAY = 86_400_000

/**
 * How many Gmail fetches run at once.
 *
 * The sweep used to fetch one message at a time at ~0.85s each, which put a
 * two-day window at 297s against a 300s function limit — the 05:00 and
 * 06:00 scheduled sweeps on 17 Sept were killed mid-run and recorded
 * nothing. Eight in flight is well inside Gmail's per-user rate limit
 * (messages.get costs 5 units) — eight was not, once several sweeps ran close
 * together — and still several times faster than one at a time.
 */
const GMAIL_CONCURRENCY = 4

/** Promise.all with at most `limit` in flight, results in input order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

/**
 * Builds the exclusion and matching sets once per sweep.
 *
 * The internal set is the safeguard that makes a full-mailbox sweep
 * acceptable: candidates, coaches and recruiters are product relationships
 * with their own systems of record, so their mail is excluded from logging
 * AND from suggestion rather than filtered out later.
 */
export async function buildSweepContext(
  selfEmail: string | null,
  extraSelf: string[] = [],
): Promise<SweepContext> {
  const [people, candidates, coaches, recruiters, setting] = await Promise.all([
    prisma.crmPerson.findMany({
      where: { OR: [{ email: { not: null } }, { emails: { isEmpty: false } }] },
      select: { id: true, email: true, emails: true },
    }),
    prisma.candidateProfile.findMany({ select: { email: true } }),
    prisma.coach.findMany({ select: { workEmail: true } }),
    prisma.recruiter.findMany({ select: { workEmail: true } }),
    prisma.crmSyncSetting.findUnique({ where: { id: 'singleton' }, select: { selfEmails: true } }),
  ])

  // Keyed by the canonical mailbox (Gmail dots/+tags collapsed), and looked
  // up the same way in classifyParticipant, so a contact who writes from
  // j.smith@gmail.com isn't treated as a stranger because their record says
  // jsmith@gmail.com — which used to create a second person.
  const crmByEmail = new Map<string, string>()
  for (const p of people) {
    for (const raw of [p.email, ...p.emails]) {
      const e = canonicalEmail(raw)
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

  // Every address that is you: the connected mailbox, its send-as aliases
  // (passed in, read from Gmail), the ones listed on Activity sync, and the
  // admin allowlist. Mail forwarded in from any of them is yours, not
  // correspondence — and an address here is never turned into a "person".
  const selfEmails = new Set<string>()
  for (const raw of [
    selfEmail, ...extraSelf, ...(setting?.selfEmails ?? []),
    ...(process.env.ADMIN_EMAILS ?? '').split(','),
  ]) {
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
  // An outbound email that doesn't mention NextChapter sits unreviewed —
  // see CrmActivity.needsReview — and an unconfirmed message shouldn't move
  // "last contacted" or "waiting on a reply" until a human says it counts.
  needsReview: false,
}

export async function refreshTouchFields(personIds: string[]) {
  const ids = [...new Set(personIds)]
  if (ids.length === 0) return

  // Three queries for any number of people, then one UPDATE. This used to be
  // five round trips per person, one person at a time — at ~100-400ms a trip
  // it was most of a sweep's runtime, and a big part of why the scheduled
  // sweep was being killed at its 300s limit.
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500)
    const where = { personId: { in: chunk }, ...REAL_TOUCH }
    const [aggs, inbound, latest] = await Promise.all([
      prisma.crmActivity.groupBy({
        by: ['personId'], where,
        _count: { _all: true }, _min: { occurredAt: true }, _max: { occurredAt: true },
      }),
      prisma.crmActivity.groupBy({
        by: ['personId'], where: { ...where, direction: 'INBOUND' },
        _min: { occurredAt: true },
      }),
      // Whichever real activity happened most recently, regardless of
      // direction — if it's ours, we're the last one to have spoken and are
      // waiting on them.
      prisma.crmActivity.findMany({
        where, orderBy: [{ personId: 'asc' }, { occurredAt: 'desc' }],
        distinct: ['personId'], select: { personId: true, occurredAt: true, direction: true },
      }),
    ])
    const agg = new Map(aggs.map((a) => [a.personId, a]))
    const firstIn = new Map(inbound.map((a) => [a.personId, a._min.occurredAt]))
    const last = new Map(latest.map((a) => [a.personId, a]))

    const rows = chunk.map((id) => {
      const a = agg.get(id)
      const l = last.get(id)
      return {
        id,
        count: a?._count._all ?? 0,
        lastAt: a?._max.occurredAt ?? null,
        firstAt: a?._min.occurredAt ?? null,
        firstInAt: firstIn.get(id) ?? null,
        awaiting: l?.direction === 'OUTBOUND' ? l.occurredAt : null,
      }
    })

    // A person with no remaining activity still gets zeroed — which is what
    // keeps a removed activity from leaving a phantom touch behind.
    // One JSON parameter, not six typed arrays. With arrays, Postgres infers
    // each one's type from its values — and a column that's empty for every
    // row in the batch (nobody replied, say) carries no type at all, so the
    // UPDATE failed outright. That hit exactly the small refreshes: one
    // logged contact, one mail check, a sync that touched only non-repliers.
    const payload = JSON.stringify(rows.map((r) => ({
      id: r.id,
      count: r.count,
      last_at: r.lastAt?.toISOString() ?? null,
      first_at: r.firstAt?.toISOString() ?? null,
      first_in_at: r.firstInAt?.toISOString() ?? null,
      awaiting: r.awaiting?.toISOString() ?? null,
    })))
    // timestamp without time zone ignores the trailing Z, which is what we
    // want: every DateTime here is stored as UTC wall-clock time.
    await prisma.$executeRaw`
      UPDATE "CrmPerson" AS p SET
        "touchCount" = v.count,
        "lastTouchedAt" = v.last_at,
        "firstTouchedAt" = v.first_at,
        "firstRepliedAt" = v.first_in_at,
        "awaitingReplySince" = v.awaiting
      FROM jsonb_to_recordset(${payload}::jsonb) AS v(
        id text, count int, last_at timestamp, first_at timestamp, first_in_at timestamp, awaiting timestamp
      )
      WHERE p.id = v.id`
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

  // Any record holding this mailbox — in either address field, in any Gmail
  // spelling, live or deleted. Only the primary field used to be checked.
  const existing = await findEmailOwner(email, { includeDeleted: true })
  if (existing) {
    cache.set(email, existing.deleted ? null : existing.id)
    return existing.deleted ? null : { id: existing.id, created: false }
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
  /** Messages Gmail would not return even after retrying. Never silently zero. */
  failed?: number
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
export async function sweepGmail(days = 14, maxMessages = 1000, runSource = 'gmail'): Promise<SweepResult> {
  const base: SweepResult = { source: 'gmail', scanned: 0, matched: 0, activitiesCreated: 0, suggested: 0, skippedInternal: 0 }
  const connection = await getActiveGoogleConnection()
  if (!connection) return { ...base, reason: 'no_connection' }
  const token = await getValidAccessToken()
  if (!token) return { ...base, reason: 'no_token' }

  // The rolling window never reaches back past the cutoff, however wide a
  // `days` a manual backfill passes.
  const rollingFrom = new Date(Date.now() - days * DAY)
  const windowFrom = rollingFrom < CRM_ACTIVITY_CUTOFF ? CRM_ACTIVITY_CUTOFF : rollingFrom
  // `runSource` labels a hand-triggered sweep separately ('gmail-manual'), so
  // the scheduled sweep's "is one due yet" check can ignore it — otherwise
  // pressing Sync now at teatime would push the next full sweep a whole
  // interval past it.
  const run = await prisma.crmSyncRun.create({ data: { source: runSource, windowFrom } })

  try {
    const selfEmail = (await getProfileEmail(token)) ?? connection.email
    const ctx = await buildSweepContext(selfEmail, await getSendAsAddresses(token))
    const ids = await listMessagesSince(token, windowFrom, maxMessages)
    const touched = new Set<string>()
    const personCache = new Map<string, string | null>()
    const result = { ...base }

    // A fetch that fails after retrying is counted, not skipped. It used to
    // come back as null and read as "no such message", so throttled mail
    // vanished from the sync without a trace.
    let failed = 0
    const headers = await mapLimit(ids, GMAIL_CONCURRENCY, async (id) => {
      try {
        return await getMessageHeaders(token, id)
      } catch {
        failed++
        return null
      }
    })

    // Messages already logged need no body: the write below is an upsert
    // that changes nothing. Re-running a window used to re-download every
    // body anyway, one at a time — most of a sweep's runtime.
    const logged = new Set<string>()
    const loggedRefs = new Set<string>()
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100)
      const rows = await prisma.crmActivity.findMany({
        where: { type: 'EMAIL', OR: chunk.map((id) => ({ sourceRef: { startsWith: `${id}:` } })) },
        select: { sourceRef: true },
      })
      for (const r of rows) {
        if (!r.sourceRef) continue
        loggedRefs.add(r.sourceRef)
        logged.add(r.sourceRef.split(':')[0])
      }
    }

    // Bodies for everything that will actually be written, fetched together
    // up front. Whether a message will be written is decidable in memory:
    // it needs one participant who isn't us, internal, or automated.
    const wantsBody = (msg: NonNullable<(typeof headers)[number]>) =>
      [msg.from, ...msg.to, ...msg.cc].some((raw) => {
        const e = normalizeEmail(raw)
        if (!e) return false
        const k = classifyParticipant(e, ctx).kind
        return k !== 'internal' && k !== 'self' && k !== 'automated'
      })
    const bodies = new Map<string, string | null>()
    const needBodies = ids.filter((id, i) => {
      const m = headers[i]
      if (!m || !isAfterCrmCutoff(m.internalDate) || logged.has(id) || !wantsBody(m)) return false
      // An inbound message that never mentions NextChapter is never written
      // at all (see the main loop below) — no point paying for its body.
      const direction = directionOf(normalizeEmail(m.from), ctx)
      if (direction === 'INBOUND' && !mentionsNextChapter(m.subject, m.snippet)) return false
      return true
    })
    await mapLimit(needBodies, GMAIL_CONCURRENCY, async (id) => { bodies.set(id, await getMessageBody(token, id)) })

    for (const [i, id] of ids.entries()) {
      const msg = headers[i]
      if (!msg) continue
      // Belt and braces: the query already asked for nothing older, but a
      // message's internalDate is the thing the activity is dated by.
      if (!isAfterCrmCutoff(msg.internalDate)) continue
      result.scanned++

      const fromEmail = normalizeEmail(msg.from)
      const direction = directionOf(fromEmail, ctx)
      const relevant = mentionsNextChapter(msg.subject, msg.snippet)
      // Inbound mail that never mentions NextChapter is never added to the
      // CRM at all — no activity, no new person from it, by direct
      // instruction. Outbound mail that doesn't mention it is still logged
      // (see needsReview below) — it's real outreach, just needing a human
      // to confirm it belongs here before it counts as contact.
      if (direction === 'INBOUND' && !relevant) continue

      const participants = [msg.from, ...msg.to, ...msg.cc]
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

        // Already on file for this person: nothing to write, and nothing about
        // them has changed, so they needn't be refreshed either. Re-covering a
        // window — which Sync now does deliberately — costs almost nothing.
        if (loggedRefs.has(`${id}:${personId}`)) {
          loggedForThisMessage = true
          continue
        }

        // A message can involve several such people; each gets the activity.
        if (fullBody === undefined) {
          fullBody = bodies.has(id) ? bodies.get(id)! : logged.has(id) ? null : await getMessageBody(token, id)
        }
        const created = await prisma.crmActivity.upsert({
          where: { type_sourceRef: { type: 'EMAIL', sourceRef: `${id}:${personId}` } },
          create: {
            type: 'EMAIL',
            direction,
            occurredAt: msg.internalDate,
            personId,
            subject: msg.subject,
            // A known CRM contact's mail is worth the real message, not
            // Gmail's ~200-char snippet — falls back to the snippet only if
            // the full-body fetch itself failed (never on an empty body).
            body: fullBody ?? snippetOf(msg.snippet),
            isAutoLogged: true,
            sourceRef: `${id}:${personId}`,
            // Always false here — an INBOUND row only ever reaches this line
            // when `relevant` is true (see the guard above).
            needsReview: direction === 'OUTBOUND' && !relevant,
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
    result.failed = failed
    await prisma.crmSyncRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(), scanned: result.scanned, matched: result.matched,
        activitiesCreated: result.activitiesCreated, suggested: result.suggested,
        skippedInternal: result.skippedInternal,
        // Marks the run incomplete, which is the point: Sync now starts from
        // the last CLEAN run, so the next click re-covers this window.
        ...(failed > 0 ? { error: `${failed} of ${ids.length} messages could not be fetched from Gmail` } : {}),
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
export async function sweepCalendar(daysBack = 14, daysForward = 1, runSource = 'calendar'): Promise<SweepResult> {
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
  // A hand-triggered sweep is labelled separately ('calendar-manual') for the
  // same reason sweepGmail's is: the scheduled "is one due" check ignores it.
  const run = await prisma.crmSyncRun.create({ data: { source: runSource, windowFrom } })

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
  /** Messages Gmail would not return even after retrying. */
  failed?: number
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
  let failed = 0
  let oldestAt: Date | null = null

  try {
    // Every message here is kept, so headers and bodies are both needed —
    // fetched together, several at once, then written in order.
    const fetched = await mapLimit(ids, GMAIL_CONCURRENCY, async (id) => {
      try {
        const msg = await getMessageHeaders(token, id)
        if (!msg || !isAfterCrmCutoff(msg.internalDate)) return null
        const direction = directionOf(normalizeEmail(msg.from), ctx)
        // Same rule as the sweep: an inbound message that never mentions
        // NextChapter is never written, so there's no point paying for its
        // body either.
        if (direction === 'INBOUND' && !mentionsNextChapter(msg.subject, msg.snippet)) return null
        return { id, msg, direction, fullBody: await getMessageBody(token, id) }
      } catch {
        failed++
        return null
      }
    })

    for (const item of fetched) {
      if (!item) continue
      const { id, msg, direction, fullBody } = item
      const relevant = mentionsNextChapter(msg.subject, msg.snippet)
      await prisma.crmActivity.upsert({
        where: { type_sourceRef: { type: 'EMAIL', sourceRef: `${id}:${personId}` } },
        create: {
          type: 'EMAIL',
          direction,
          occurredAt: msg.internalDate,
          personId,
          subject: msg.subject,
          body: fullBody ?? snippetOf(msg.snippet),
          isAutoLogged: true,
          sourceRef: `${id}:${personId}`,
          needsReview: direction === 'OUTBOUND' && !relevant,
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
  return { found, oldestAt, ...(failed > 0 ? { failed } : {}) }
}
