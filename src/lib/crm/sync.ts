import 'server-only'
import { applyEmailPriorityBumps } from '@/lib/crm/priority-bump'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAllGoogleConnections, getValidAccessTokenFor } from '@/lib/google/connection'
import type { GoogleInboxConnection } from '@prisma/client'
import { listMessagesSince, listMessagesForAddress, getMessageHeaders, getMessageBody, getMessageContent, getProfileEmail, getSendAsAddresses } from '@/lib/google/gmail'
import { listCalendarEvents, fetchGoogleDocText, NotesFetchError } from '@/lib/google/admin-calendar'
import { capNotes } from '@/lib/google/meeting-notes'
import { createTodosFromNotes } from '@/lib/crm/meeting-todos'
import { captureServerEvent } from '@/lib/posthog/server'
import { getAllAdminCalendarAccess } from '@/lib/webinars/admin-calendar-oauth'
import {
  normalizeEmail, displayNameFrom, personNameFromDisplay, classifyParticipant, snippetOf, directionOf, mentionsNextChapter, appointmentBooker, isSelf,
  type SweepContext,
} from './sync-matching'
import type { CalendarAttendee } from '@/lib/google/admin-calendar'
import { isPlaceholderName } from '@/lib/resume/placeholder-name'
import { looksLikeNotAPerson } from './person-plausibility'
import { CRM_ACTIVITY_CUTOFF, isAfterCrmCutoff } from './cutoff'
import { canonicalEmail, findEmailOwner } from './email-owner'
import { namesLookAlike } from '@/lib/text/person-name-match'
import { detectReportEdition } from '@/lib/mailing/edition-parser'
import { buildOutreachReplyEmails } from '@/lib/outreach/reply-context'
import { classifyReply, replyOutcome } from '@/lib/outreach/reply-class'
import { alertOutreachReply } from '@/lib/outreach/reply-alert'
import { buildMailingSweepContext, markReportManual, onInboundMessage, type MailingSweepContext } from '@/lib/mailing/tracking'
import { raiseListPrompt } from '@/lib/mailing/lists'

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
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
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
      // Live records only. A removed or merged-away record keeps its
      // addresses, and matching mail to it logged new activity on a row
      // nobody can see — including, after a merge, mail that belonged on the
      // record it was merged into. Whether a removed person stays excluded
      // is decided in getOrCreatePerson, which does look at removed rows.
      where: { deletedAt: null, OR: [{ email: { not: null } }, { emails: { isEmpty: false } }] },
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
 * Mail to family and friends is personal, not outreach — it never needs a
 * "does this belong in the CRM?" review. True when the person's only role is
 * Friends and family (the same test meeting-prep uses). Cached per sweep.
 */
export async function isFriendsFamilyOnly(personId: string, cache: Map<string, boolean>): Promise<boolean> {
  const hit = cache.get(personId)
  if (hit !== undefined) return hit
  const row = await prisma.crmPerson.findUnique({ where: { id: personId }, select: { roles: true } })
  const only = !!row && row.roles.length > 0 && row.roles.every((r) => r === 'FRIENDS_FAMILY')
  cache.set(personId, only)
  return only
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
        distinct: ['personId'], select: { personId: true, occurredAt: true, direction: true, type: true },
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
        // A meeting you attended isn't a message awaiting an answer — the
        // calendar sweep logs every one as outbound, which used to leave
        // people "waiting on a reply" for a coffee that already happened.
        awaiting: l?.direction === 'OUTBOUND' && l.type !== 'MEETING' ? l.occurredAt : null,
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

  // Someone emailing with you is at least P1 (P0 if it's a lot) — see
  // priority-bump.ts. Runs here because this is the one place every email
  // write already funnels through.
  await applyEmailPriorityBumps(ids)
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

  const normalized = personNameFromDisplay(rawName)
  const name = normalized && !isPlaceholderName(normalized) ? normalized : null
  const fullName = name ?? email.split('@')[0]

  // Someone already in the CRM by name but with no email on file (added
  // from LinkedIn, say) is this person: give that record the address
  // instead of creating a second one. Only when exactly one such record
  // looks alike; two or more is a guess, so the new row is created and the
  // Review List's duplicate check puts the pair in front of a human.
  if (name) {
    const surname = name.split(' ').pop()!
    const sameName = (await prisma.crmPerson.findMany({
      where: { deletedAt: null, email: null, emails: { isEmpty: true }, fullName: { contains: surname, mode: 'insensitive' } },
      select: { id: true, fullName: true },
      take: 50,
    })).filter((p) => namesLookAlike(p.fullName, name))
    if (sameName.length === 1) {
      await prisma.crmPerson.update({ where: { id: sameName[0].id }, data: { email, emails: [email] } })
      cache.set(email, sameName[0].id)
      return { id: sameName[0].id, created: false }
    }
  }

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

/**
 * After an email you sent is logged: a White Collar Employment Report attachment or
 * link marks that person as having received that month's report (MANUAL),
 * and anyone not yet on the lists that fit them gets an "Add to a mailing
 * list?" card. Mail that doesn't mention NextChapter (needsReview) raises
 * no card — personal mail shouldn't fill the queue.
 */
async function onOutboundEmail(input: {
  personId: string; activityId: string; at: Date; subject: string | null
  body: string | null | undefined; attachmentNames: string[]; needsReview: boolean
}) {
  const editionKey = detectReportEdition({ attachmentNames: input.attachmentNames, body: input.body })
  if (editionKey) {
    await markReportManual({
      personId: input.personId, editionKey, channel: 'EMAIL', sentAt: input.at,
      activityId: input.activityId, subject: input.subject,
    })
  }
  if (!input.needsReview || editionKey) await raiseListPrompt(input.personId, input.activityId, input.at)
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
  /** Calendar only: meetings that got a Gemini notes doc copied onto them this run. */
  notesAttached?: number
  /** Calendar only: notes exist but the Google grant predates documents.readonly. */
  notesNeedReconnect?: boolean
  /** Calendar only: to-dos made from "Next steps" in those notes, and how many got a Google reminder. */
  todosCreated?: number
  remindersCreated?: number
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
/** What one mailbox contributed to a Gmail sweep. */
interface MailboxOutcome { result: SweepResult; failed: number; ids: number }

/**
 * Sweeps one connected Gmail mailbox over a window, logging what involves a
 * CRM person. Called once per connected account by sweepGmail.
 */
async function sweepMailbox(
  connection: GoogleInboxConnection,
  token: string,
  windowFrom: Date,
  maxMessages: number,
  otherEmails: string[],
  base: SweepResult,
): Promise<MailboxOutcome> {
  const selfEmail = (await getProfileEmail(token)) ?? connection.email
  // Every connected mailbox is you, so mail between them isn't correspondence.
  const ctx = await buildSweepContext(selfEmail, [...(await getSendAsAddresses(token)), ...otherEmails])
  const ids = await listMessagesSince(token, windowFrom, maxMessages)
  const touched = new Set<string>()
  const personCache = new Map<string, string | null>()
  const familyCache = new Map<string, boolean>()
  const result = { ...base }

  // A fetch that fails after retrying is counted, not skipped. It used to
  // come back as null and read as "no such message", so throttled mail
  // vanished from the sync without a trace.
  const unread: number[] = []
  const headers = await mapLimit(ids, GMAIL_CONCURRENCY, async (id, i) => {
    try {
      return await getMessageHeaders(token, id)
    } catch {
      unread.push(i)
      return null
    }
  })
  // One more go at whatever was refused, one at a time. By now the calls
  // above have waited out any rate limit, so this is usually all it takes
  // to turn a partial run into a complete one.
  let failed = 0
  for (const i of unread) {
    try {
      headers[i] = await getMessageHeaders(token, ids[i])
    } catch {
      failed++
    }
  }

  // The best display name seen for each address anywhere in the window. A
  // reply typed to a bare address carries no name, and it is the newest
  // message, so it is read first — which named a new person "kgold" when
  // the introduction two hours earlier said "Kelly Gold".
  const nameByEmail = new Map<string, string>()
  for (const m of headers) {
    if (!m) continue
    for (const raw of [m.from, ...m.to, ...m.cc]) {
      const e = normalizeEmail(raw)
      const n = displayNameFrom(raw)
      if (e && n && !isPlaceholderName(n) && !nameByEmail.has(e)) nameByEmail.set(e, n)
    }
  }

  // Messages already logged need no body: the write below is an upsert
  // that changes nothing. Re-running a window used to re-download every
  // body anyway, one at a time — most of a sweep's runtime.
  const logged = new Set<string>()
  const loggedRefs = new Set<string>()
  // Rows logged before thread ids were stored — filled in as the sweep meets them again.
  const needsThreadId = new Set<string>()
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const rows = await prisma.crmActivity.findMany({
      where: { type: 'EMAIL', OR: chunk.map((id) => ({ sourceRef: { startsWith: `${id}:` } })) },
      select: { sourceRef: true, threadId: true },
    })
    for (const r of rows) {
      if (!r.sourceRef) continue
      loggedRefs.add(r.sourceRef)
      logged.add(r.sourceRef.split(':')[0])
      if (!r.threadId) needsThreadId.add(r.sourceRef.split(':')[0])
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
  const bodies = new Map<string, { body: string | null; attachmentNames: string[] }>()
  const needBodies = ids.filter((id, i) => {
    const m = headers[i]
    if (!m || !isAfterCrmCutoff(m.internalDate) || logged.has(id) || !wantsBody(m)) return false
    // An inbound message that never mentions NextChapter is never written
    // at all (see the main loop below) — no point paying for its body.
    if (appointmentBooker(m.subject)) return true
    const direction = directionOf(normalizeEmail(m.from), ctx)
    if (direction === 'INBOUND' && !mentionsNextChapter(m.subject, m.snippet)) return false
    return true
  })
  await mapLimit(needBodies, GMAIL_CONCURRENCY, async (id) => { bodies.set(id, await getMessageContent(token, id)) })

  // Mailing lists: unsubscribe replies and replies to a report. Never
  // allowed to fail the sweep — the CRM log matters more.
  let mailingCtx: MailingSweepContext | null = null
  try { mailingCtx = await buildMailingSweepContext() } catch (e) { console.error('Mailing sweep context failed', e) }
  let outreachEmails = new Set<string>()
  try { outreachEmails = await buildOutreachReplyEmails() } catch (e) { console.error('Outreach reply context failed', e) }

  for (const [i, id] of ids.entries()) {
    const msg = headers[i]
    if (!msg) continue
    // Belt and braces: the query already asked for nothing older, but a
    // message's internalDate is the thing the activity is dated by.
    if (!isAfterCrmCutoff(msg.internalDate)) continue
    result.scanned++

    const fromEmail = normalizeEmail(msg.from)
    // A booking on your calendar page is the other person's doing, however
    // the notice is addressed — see appointmentBooker.
    const booking = appointmentBooker(msg.subject)
    const direction = booking ? 'INBOUND' : directionOf(fromEmail, ctx)
    // A reply from someone we cold-emailed is always logged, even if it never says NextChapter ("Thanks, send it over").
    const outreachReply = direction === 'INBOUND' && !!fromEmail && outreachEmails.has(fromEmail)
    const relevant = booking ? true : outreachReply || mentionsNextChapter(msg.subject, msg.snippet)
    if (direction === 'INBOUND' && mailingCtx && fromEmail && !booking) {
      await onInboundMessage(mailingCtx, { id, fromEmail, subject: msg.subject, snippet: msg.snippet, at: msg.internalDate })
        .catch((e) => console.error('Mailing inbound hook failed', id, e))
    }
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
    let attachmentNames: string[] = []

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
        const resolved = await getOrCreatePerson(email, displayNameFrom(raw) ?? nameByEmail.get(email) ?? booking?.name ?? null, personCache)
        if (!resolved) continue // deleted before — stays excluded, not silently re-added
        personId = resolved.id
        isNewPerson = resolved.created
      }

      // Already on file for this person: nothing to write, and nothing about
      // them has changed, so they needn't be refreshed either. Re-covering a
      // window — which Sync now does deliberately — costs almost nothing.
      if (loggedRefs.has(`${id}:${personId}`)) {
        loggedForThisMessage = true
        if (needsThreadId.delete(id)) {
          await prisma.crmActivity.updateMany({ where: { type: 'EMAIL', sourceRef: { startsWith: `${id}:` }, threadId: null }, data: { threadId: msg.threadId } })
        }
        continue
      }

      // A message can involve several such people; each gets the activity.
      // Reaching here means this person has no row for the message yet —
      // including when someone else on it already does, as when an address
      // is added to a contact after the message was first swept.
      if (fullBody === undefined) {
        const content = bodies.get(id) ?? await getMessageContent(token, id)
        fullBody = content.body
        attachmentNames = content.attachmentNames
      }
      const needsReview = direction === 'OUTBOUND' && !relevant && !(await isFriendsFamilyOnly(personId, familyCache))
      const created = await prisma.crmActivity.upsert({
        where: { type_sourceRef: { type: 'EMAIL', sourceRef: `${id}:${personId}` } },
        create: {
          type: 'EMAIL',
          direction,
          occurredAt: msg.internalDate,
          personId,
          subject: msg.subject,
          threadId: msg.threadId,
          // A known CRM contact's mail is worth the real message, not
          // Gmail's ~200-char snippet — falls back to the snippet only if
          // the full-body fetch itself failed (never on an empty body).
          body: fullBody ?? snippetOf(msg.snippet),
          isAutoLogged: true,
          sourceRef: `${id}:${personId}`,
          // A reply to cold outreach is labelled positive, a question, a referral, no, or automatic, for the Outreach tests page.
          outcome: outreachReply ? replyOutcome(classifyReply(msg.subject, fullBody ?? msg.snippet)) : undefined,
          // Always false here — an INBOUND row only ever reaches this line
          // when `relevant` is true (see the guard above).
          needsReview,
        },
        update: {},
        select: { id: true, createdAt: true },
      })
      // upsert gives no "was created" flag; a fresh row is one written now.
      if (Date.now() - created.createdAt.getTime() < 5_000) result.activitiesCreated++
      if (direction === 'OUTBOUND' && !booking) {
        await onOutboundEmail({
          personId, activityId: created.id, at: msg.internalDate, subject: msg.subject,
          body: fullBody, attachmentNames, needsReview,
        }).catch((e) => console.error('Mailing outbound hook failed', id, e))
      }
      if (outreachReply && Date.now() - created.createdAt.getTime() < 5_000) {
        const replyClass = classifyReply(msg.subject, fullBody ?? msg.snippet)
        captureServerEvent(personId, 'outreach_reply_received', { class: replyClass })
        await alertOutreachReply({ personId, replyClass, subject: msg.subject, text: fullBody ?? snippetOf(msg.snippet) })
      }
      if (isNewPerson) result.suggested++
      touched.add(personId)
      loggedForThisMessage = true
    }

    if (hasInternal && !loggedForThisMessage) result.skippedInternal++
    if (loggedForThisMessage) result.matched++
  }

  await refreshTouchFields([...touched])
  result.failed = failed
  return { result, failed, ids: ids.length }
}

export async function sweepGmail(days = 14, maxMessages = 1000, runSource = 'gmail'): Promise<SweepResult> {
  const base: SweepResult = { source: 'gmail', scanned: 0, matched: 0, activitiesCreated: 0, suggested: 0, skippedInternal: 0 }
  const connections = await getAllGoogleConnections()
  if (connections.length === 0) return { ...base, reason: 'no_connection' }
  // A mailbox whose token can't be refreshed is skipped and reported; the others still sweep.
  const mailboxes: { connection: GoogleInboxConnection; token: string }[] = []
  const errors: string[] = []
  for (const connection of connections) {
    try {
      const token = await getValidAccessTokenFor(connection)
      if (token) mailboxes.push({ connection, token })
    } catch (e) {
      errors.push(`${connection.email}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  if (mailboxes.length === 0) {
    if (errors.length) {
      await prisma.crmSyncRun.create({ data: { source: runSource, windowFrom: new Date(), finishedAt: new Date(), error: errors.join('; ').slice(0, 500) } })
    }
    return { ...base, reason: 'no_token' }
  }

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
    const result = { ...base }
    let failed = 0
    let ids = 0
    for (const { connection, token } of mailboxes) {
      try {
        const one = await sweepMailbox(connection, token, windowFrom, maxMessages, connections.map((c) => c.email), base)
        result.scanned += one.result.scanned
        result.matched += one.result.matched
        result.activitiesCreated += one.result.activitiesCreated
        result.suggested += one.result.suggested
        result.skippedInternal += one.result.skippedInternal
        failed += one.failed
        ids += one.ids
      } catch (e) {
        errors.push(`${connection.email}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    // Every mailbox failing is the sweep failing; one failing is recorded on
    // the run (so the sync-health banner shows it) while the rest are kept.
    if (errors.length >= connections.length) throw new Error(errors.join('; ').slice(0, 500))
    result.failed = failed
    await prisma.crmSyncRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(), scanned: result.scanned, matched: result.matched,
        activitiesCreated: result.activitiesCreated, suggested: result.suggested,
        skippedInternal: result.skippedInternal,
        // Marks the run incomplete, which is the point: Sync now starts from
        // the last CLEAN run, so the next click re-covers this window.
        ...(errors.length ? { error: errors.join('; ').slice(0, 500) } : failed > 0 ? { error: `${failed} of ${ids} messages could not be fetched from Gmail` } : {}),
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
 * How many days back the calendar sweep must reach to cover everything since
 * its last clean run. Meeting notes are written by Google whether or not this
 * connection is working, so after an outage the sweep has to reach back to the
 * last good run (not the last good Gmail run — the two break independently)
 * for the notes made meanwhile to be copied across. Never less than `floor`,
 * never more than 60 days.
 */
export async function calendarLookbackDays(floor = 2): Promise<number> {
  const lastOk = await prisma.crmSyncRun.findFirst({
    where: { source: { in: ['calendar', 'calendar-manual'] }, finishedAt: { not: null }, error: null },
    orderBy: { startedAt: 'desc' },
    select: { startedAt: true },
  })
  const sinceOk = lastOk ? Math.ceil((Date.now() - lastOk.startedAt.getTime()) / DAY) + 1 : 14
  return Math.min(60, Math.max(floor, sinceOk))
}

/**
 * Where a meeting with this person belongs besides their own record: the
 * organization they're currently affiliated with, and the open opportunity
 * it relates to — theirs first, else the organization's most recent one.
 * Null parts are simply left off the activity.
 */
async function meetingContextFor(personId: string): Promise<{ orgId: string | null; opportunityId: string | null }> {
  const aff = await prisma.crmAffiliation.findFirst({
    where: { personId, isCurrent: true },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    select: { orgId: true },
  })
  const own = await prisma.crmOpportunity.findFirst({
    where: { outcome: 'OPEN', primaryPersonId: personId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, orgId: true },
  })
  const opp = own ?? (aff
    ? await prisma.crmOpportunity.findFirst({
        where: { outcome: 'OPEN', orgId: aff.orgId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, orgId: true },
      })
    : null)
  return { orgId: aff?.orgId ?? opp?.orgId ?? null, opportunityId: opp?.id ?? null }
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
  // Every connected Google account is swept. None connected is "nothing to
  // sweep", not an error worth failing on; an account whose token no longer
  // refreshes is skipped and reported, so the others still run.
  const accounts = await getAllAdminCalendarAccess()
  const usable = accounts.filter((a): a is typeof a & { token: string } => !!a.token)
  const accountErrors = accounts.filter((a) => a.error).map((a) => `${a.googleEmail ?? 'unknown account'}: ${a.error}`)
  if (usable.length === 0) {
    // Connected but every token is dead: leave a failed run behind so the
    // sync-health banner says so, instead of a quiet "nothing to sweep".
    if (accounts.length) {
      await prisma.crmSyncRun.create({
        data: { source: runSource, windowFrom: new Date(), finishedAt: new Date(), error: accountErrors.join('; ').slice(0, 500) },
      })
    }
    return { ...base, reason: accounts.length ? 'no_valid_token' : 'no_connection' }
  }

  const rollingFrom = new Date(Date.now() - daysBack * DAY)
  const windowFrom = rollingFrom < CRM_ACTIVITY_CUTOFF ? CRM_ACTIVITY_CUTOFF : rollingFrom
  // A hand-triggered sweep is labelled separately ('calendar-manual') for the
  // same reason sweepGmail's is: the scheduled "is one due" check ignores it.
  const run = await prisma.crmSyncRun.create({ data: { source: runSource, windowFrom } })

  try {
    // Each connected address is you, so one account being invited to a
    // meeting from the other is not a new person.
    const ctx = await buildSweepContext(null, usable.flatMap((a) => (a.googleEmail ? [a.googleEmail] : [])))
    // An event both accounts can see is read once per account on purpose: the
    // notes doc is only readable from an account it was shared with, and a
    // notes copy already made is never repeated (see notesDocUrl below).
    const windowTo = new Date(Date.now() + daysForward * DAY)
    const items: { ev: Awaited<ReturnType<typeof listCalendarEvents>>[number]; token: string }[] = []
    for (const account of usable) {
      try {
        for (const ev of await listCalendarEvents(account.token, windowFrom, windowTo)) items.push({ ev, token: account.token })
      } catch (e) {
        accountErrors.push(`${account.googleEmail ?? 'unknown account'}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    if (items.length === 0 && accountErrors.length >= usable.length) throw new Error(accountErrors.join('; '))
    const touched = new Set<string>()
    const personCache = new Map<string, string | null>()
    const result = { ...base }
    // The soonest meeting still ahead for each person on one.
    const upcoming = new Map<string, { at: Date; url: string | null }>()
    const contextCache = new Map<string, Promise<{ orgId: string | null; opportunityId: string | null }>>()
    const contextOf = (personId: string) => {
      let c = contextCache.get(personId)
      if (!c) { c = meetingContextFor(personId); contextCache.set(personId, c) }
      return c
    }
    let notesAttached = 0
    let todosCreated = 0
    let remindersCreated = 0
    // Accounts whose grant can't read Docs, and notes reads that failed for a
    // reason worth retrying: both are recorded on the run (see `problems`).
    const needsDocsAccess = new Set<string>()
    let notesFailed = 0

    const attendeeName = (a: CalendarAttendee) => a.displayName || displayNameFrom(a.email)

    for (const { ev, token } of items) {
      result.scanned++
      const isPast = ev.start.getTime() <= Date.now()
      let logged = false
      let hasInternal = false
      // Gemini's notes doc, read at most once per event and only when someone
      // already in the CRM was on it: an unknown attendee is only a suggestion,
      // and a call with a stranger is not something to copy notes onto.
      let notesRead: Promise<string | null> | undefined
      const notesFor = () => {
        if (!ev.notesDoc || needsDocsAccess.has(token)) return Promise.resolve(null)
        notesRead ??= fetchGoogleDocText(token, ev.notesDoc.fileId)
          .then((t) => (t ? capNotes(t) : null))
          .catch((e) => {
            if (e instanceof NotesFetchError && e.kind === 'needs_reconnect') needsDocsAccess.add(token)
            else if (!(e instanceof NotesFetchError) || e.kind === 'failed') notesFailed++
            return null
          })
        return notesRead
      }

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
        // itself is still created above so they're findable before then, and
        // the meeting is noted as scheduled. A meeting older than the cutoff
        // is the same case in reverse: the attendee is still worth having,
        // the meeting is not an interaction.
        if (!isPast) {
          const soonest = upcoming.get(personId)
          if (!soonest || ev.start < soonest.at) upcoming.set(personId, { at: ev.start, url: ev.meetUrl })
        }
        if (!isPast || !isAfterCrmCutoff(ev.start)) continue

        const ctxRow = await contextOf(personId)
        const ref = `${ev.id}:${personId}`
        // Notes are copied once: an activity that already holds the doc keeps it.
        let notes: string | null = null
        if (ev.notesDoc && verdict.kind === 'crm') {
          const have = await prisma.crmActivity.findUnique({
            where: { type_sourceRef: { type: 'MEETING', sourceRef: ref } },
            select: { notesDocUrl: true },
          })
          if (!have?.notesDocUrl) notes = await notesFor()
        }
        const attach = {
          ...(ev.meetUrl ? { meetUrl: ev.meetUrl } : {}),
          ...(ctxRow.orgId ? { orgId: ctxRow.orgId } : {}),
          ...(ctxRow.opportunityId ? { opportunityId: ctxRow.opportunityId } : {}),
          ...(notes && ev.notesDoc ? { body: notes, notesDocUrl: ev.notesDoc.url } : {}),
        }
        const created = await prisma.crmActivity.upsert({
          where: { type_sourceRef: { type: 'MEETING', sourceRef: ref } },
          create: {
            type: 'MEETING', direction: 'OUTBOUND', occurredAt: ev.start,
            personId, subject: ev.summary ?? 'Meeting',
            isAutoLogged: true, sourceRef: ref,
            ...attach,
          },
          update: attach,
          select: { createdAt: true },
        })
        if (notes) notesAttached++
        if (notes && ev.notesDoc) {
          const person = await prisma.crmPerson.findUnique({ where: { id: personId }, select: { fullName: true } })
          const made = await createTodosFromNotes({
            notes, eventId: ev.id, eventTitle: ev.summary ?? 'Meeting', meetingAt: ev.start, notesUrl: ev.notesDoc.url,
            personId, personName: person?.fullName ?? 'them', orgId: ctxRow.orgId, opportunityId: ctxRow.opportunityId,
            selfNames: ev.attendees.filter((a) => a.email && isSelf(a.email, ctx)).map((a) => a.displayName ?? '').filter(Boolean),
            accessToken: token,
          })
          todosCreated += made.created
          remindersCreated += made.reminders
        }
        if (Date.now() - created.createdAt.getTime() < 5_000) result.activitiesCreated++
        touched.add(personId)
        logged = true
      }

      if (hasInternal && !logged) result.skippedInternal++
      if (logged) result.matched++
    }

    await refreshTouchFields([...touched])
    await setUpcomingMeetings(upcoming, new Date(Date.now() + daysForward * DAY))
    result.notesAttached = notesAttached
    result.todosCreated = todosCreated
    result.remindersCreated = remindersCreated
    if (accountErrors.length) result.reason = accountErrors.join('; ').slice(0, 300)
    const notesNeedReconnect = needsDocsAccess.size > 0
    if (notesNeedReconnect) result.notesNeedReconnect = true
    if (notesAttached > 0 || notesFailed > 0 || notesNeedReconnect) {
      captureServerEvent('system', 'crm_meeting_notes_synced', {
        notesAttached, notesFailed, todosCreated, remindersCreated, needsReconnect: notesNeedReconnect, eventsScanned: result.scanned, source: runSource,
      })
    }
    // Anything reconnecting fixes is recorded on the run, so the sync-health
    // banner shows it: an account whose access was revoked, or notes that
    // can't be read because the grant lacks Docs access.
    const problems = [
      ...accountErrors,
      ...(notesNeedReconnect ? ['Gemini notes unreadable — Docs read refused: 403 PERMISSION_DENIED'] : []),
    ]
    await prisma.crmSyncRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(), scanned: result.scanned, matched: result.matched,
        activitiesCreated: result.activitiesCreated, suggested: result.suggested,
        skippedInternal: result.skippedInternal,
        ...(problems.length ? { error: problems.join('; ').slice(0, 500) } : {}),
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
 * Writes each person's next scheduled meeting, and clears it for anyone the
 * calendar no longer has one for.
 *
 * Only dates inside the window just read are cleared: a meeting the sweep
 * could have seen and didn't has happened, moved or been cancelled, while
 * one further out than it looked is simply not known about either way.
 * Raw SQL so that noting a meeting doesn't count as editing the record.
 */
async function setUpcomingMeetings(upcoming: Map<string, { at: Date; url: string | null }>, windowEnd: Date) {
  const ids = [...upcoming.keys()]
  await prisma.$executeRaw`
    UPDATE "CrmPerson" SET "nextMeetingAt" = NULL, "nextMeetingUrl" = NULL
    WHERE "nextMeetingAt" IS NOT NULL AND "nextMeetingAt" <= ${windowEnd}
      AND NOT (id = ANY(${ids}::text[]))`
  if (ids.length === 0) return
  const payload = JSON.stringify(ids.map((id) => ({ id, at: upcoming.get(id)!.at.toISOString(), url: upcoming.get(id)!.url })))
  await prisma.$executeRaw`
    UPDATE "CrmPerson" AS p SET "nextMeetingAt" = v.at, "nextMeetingUrl" = v.url
    FROM jsonb_to_recordset(${payload}::jsonb) AS v(id text, at timestamp, url text)
    WHERE p.id = v.id
      AND (p."nextMeetingAt" IS DISTINCT FROM v.at OR p."nextMeetingUrl" IS DISTINCT FROM v.url)`
}

export interface PersonBackfillResult {
  found: number
  oldestAt: Date | null
  /** Messages Gmail would not return even after retrying. */
  failed?: number
  reason?: 'no_connection' | 'no_token' | 'invalid_email' | 'person_deleted'
}

/** One mailbox's share of backfillPersonFromEmail. */
async function backfillFromMailbox(
  personId: string,
  email: string,
  connection: GoogleInboxConnection,
  token: string,
  maxMessages: number,
  otherEmails: string[],
): Promise<PersonBackfillResult> {
  const selfEmail = normalizeEmail((await getProfileEmail(token)) ?? connection.email)
  const ctx: SweepContext = {
    // Every connected mailbox is you.
    selfEmails: new Set([selfEmail, ...otherEmails.map(normalizeEmail)].filter((e): e is string => !!e)),
    internalEmails: new Set(),
    crmByEmail: new Map(),
  }

  const ids = await listMessagesForAddress(token, email, CRM_ACTIVITY_CUTOFF, maxMessages)
  let found = 0
  let failed = 0
  let oldestAt: Date | null = null
  const familyOnly = await isFriendsFamilyOnly(personId, new Map())

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
          threadId: msg.threadId,
          body: fullBody ?? snippetOf(msg.snippet),
          isAutoLogged: true,
          sourceRef: `${id}:${personId}`,
          needsReview: direction === 'OUTBOUND' && !relevant && !familyOnly,
        },
        update: { threadId: msg.threadId },
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

  const connections = await getAllGoogleConnections()
  if (connections.length === 0) return { found: 0, oldestAt: null, reason: 'no_connection' }

  // Every connected mailbox is checked; one that can't be read is skipped.
  let found = 0
  let failed = 0
  let oldestAt: Date | null = null
  let readable = 0
  for (const connection of connections) {
    const token = await getValidAccessTokenFor(connection).catch(() => null)
    if (!token) continue
    readable++
    const one = await backfillFromMailbox(personId, email, connection, token, maxMessages, connections.map((c) => c.email))
    found += one.found
    failed += one.failed ?? 0
    if (one.oldestAt && (!oldestAt || one.oldestAt < oldestAt)) oldestAt = one.oldestAt
  }
  if (readable === 0) return { found: 0, oldestAt: null, reason: 'no_token' }
  return { found, oldestAt, ...(failed > 0 ? { failed } : {}) }
}

