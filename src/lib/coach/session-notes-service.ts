import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { getMondayOfWeek, type CommittedAction } from '@/lib/weekly/sprint'
import { parseNextSteps } from '@/lib/google/meeting-notes'
import { getApplicableRateCents } from '@/lib/admin/coaching-rate-card'
import { collegeForSession } from '@/lib/higher-ed/coaching'
import { countCoachingSession } from '@/lib/access/grants'
import { sendCoachUpdateEmail } from '@/lib/email/send-coach-update-email'
import { canMoveTopic, isTopicKey, topicByKey, type TopicStatus } from '@/lib/coach/topics'
import {
  buildSendManifest,
  checkImportedNotes,
  cleanText,
  coachMayReadProgress,
  firstNameOf,
  followUpsFromNextSteps,
  isCaptureKind,
  isOwnerKind,
  MAX_CAPTURE_CHARS,
  MAX_FOLLOW_UP_CHARS,
  MAX_PRIVATE_NOTES_CHARS,
  MAX_SUMMARY_CHARS,
  parseDueOn,
  planActionText,
  visibleToMember,
  type CaptureKind,
  type OwnerKind,
  type SendManifest,
} from '@/lib/coach/session-notes'

// Server logic for the coach session notes (phase 1 of the coach upgrade): start a session, capture, import notes,
// edit the summary, follow-ups and topics, send, and the member's side of the same rows. Every coach function takes
// the coachId from the signed-in coach (never from the page) and re-scopes by it, the same pattern as
// src/lib/coach/access.ts. Nothing here sends anything to a member except sendToMember, which only runs when the
// coach presses "Send to <name>".

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

const NOT_FOUND = 'We could not find this session. Go back to your clients and open it again.'
const ALREADY_SENT = 'This summary was already sent, so it can no longer be changed.'

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'

type OwnedSession = {
  id: string
  candidateId: string
  coachId: string
  occurredAt: Date
  notes: string | null
  summary: { id: string; state: string; text: string; meetNotes: string | null; aiDrafted: boolean; sentAt: Date | null } | null
}

async function ownedSession(coachId: string, sessionId: string): Promise<OwnedSession | null> {
  return prisma.coachSession.findFirst({
    where: { id: sessionId, coachId },
    select: {
      id: true,
      candidateId: true,
      coachId: true,
      occurredAt: true,
      notes: true,
      summary: { select: { id: true, state: true, text: true, meetNotes: true, aiDrafted: true, sentAt: true } },
    },
  })
}

const isSent = (s: OwnedSession) => s.summary?.state === 'SENT'

// ── Starting ─────────────────────────────────────────────────────────────────

/**
 * Starts the notes for a session that is happening now: makes the CoachSession row the same way logging one does
 * (rate locked in at creation, college attribution, one session counted against the member's coaching grant), so a
 * session opened here is paid and counted exactly like one logged on the old form.
 */
export async function startSessionNotes(coachId: string, candidateId: string, opts: { durationMinutes?: number | null } = {}): Promise<Result<{ sessionId: string }>> {
  const candidate = await prisma.candidateProfile.findFirst({ where: { id: candidateId, coachId }, select: { id: true } })
  if (!candidate) return { ok: false, error: 'This link isn’t valid. Go back to your clients and open this one again.' }
  const rateSnapshotCents = await getApplicableRateCents('STANDARD', coachId)
  const session = await prisma.coachSession.create({
    data: {
      candidateId,
      coachId,
      institutionId: await collegeForSession(coachId, candidateId),
      durationMinutes: opts.durationMinutes && opts.durationMinutes > 0 ? Math.floor(opts.durationMinutes) : null,
      sessionType: 'STANDARD',
      rateSnapshotCents,
    },
    select: { id: true },
  })
  const sessionsLeft = await countCoachingSession(candidateId, coachId).catch(() => null)
  captureServerEvent(coachId, 'coach_session_notes_started', { sessionId: session.id, candidateId, sessionsLeft })
  return { ok: true, sessionId: session.id }
}

// ── The workspace ────────────────────────────────────────────────────────────

export interface WorkspaceView {
  session: { id: string; occurredAt: Date; privateNotes: string }
  member: { id: string; firstName: string; shared: boolean }
  coach: { firstName: string }
  captures: { id: string; kind: CaptureKind; text: string; createdAt: Date }[]
  summary: { text: string; state: 'DRAFT' | 'REVIEWED' | 'SENT'; aiDrafted: boolean; sentAt: Date | null; hasMeetNotes: boolean } | null
  followUps: { id: string; ownerKind: OwnerKind; text: string; dueOn: Date | null; status: 'open' | 'done' }[]
  topics: { id: string; topic: string; label: string; quote: string | null; status: TopicStatus }[]
  /** Earlier open follow-ups (from this coach's earlier sessions with this member). Empty unless the member consented. */
  earlierOpen: { id: string; ownerKind: OwnerKind; text: string; dueOn: Date | null }[]
  manifest: SendManifest
  canFetchMeetNotes: boolean
}

export async function getWorkspace(coachId: string, sessionId: string): Promise<WorkspaceView | null> {
  const session = await prisma.coachSession.findFirst({
    where: { id: sessionId, coachId },
    select: {
      id: true,
      occurredAt: true,
      notes: true,
      candidate: { select: { id: true, firstName: true, coachDossierConsentedAt: true } },
      coach: { select: { fullName: true } },
      captures: { orderBy: { createdAt: 'asc' }, select: { id: true, kind: true, text: true, createdAt: true } },
      summary: { select: { text: true, state: true, aiDrafted: true, sentAt: true, meetNotes: true } },
      followUps: { orderBy: { createdAt: 'asc' }, select: { id: true, ownerKind: true, text: true, dueOn: true, status: true } },
      topics: { orderBy: { suggestedAt: 'asc' }, select: { id: true, topic: true, quote: true, status: true } },
    },
  })
  if (!session) return null
  const memberFirst = session.candidate.firstName?.trim() || 'your client'
  const shared = coachMayReadProgress(session.candidate)
  // Consent: how the member is getting on with earlier steps is the member's progress data. Without their
  // consent the coach sees only the sessions they wrote, never what came back.
  const earlierOpen = shared
    ? await prisma.coachFollowUp.findMany({
        where: { coachId, candidateId: session.candidate.id, status: 'open', sessionId: { not: session.id }, visibleToMemberAt: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, ownerKind: true, text: true, dueOn: true },
      })
    : []
  const followUps = session.followUps.map((f) => ({ ...f, ownerKind: f.ownerKind as OwnerKind, status: f.status as 'open' | 'done' }))
  const topics = session.topics.map((t) => ({ ...t, label: topicByKey(t.topic)?.label ?? t.topic, status: t.status as TopicStatus }))
  const manifest = buildSendManifest({
    memberFirstName: memberFirst,
    summaryText: session.summary?.text ?? '',
    followUps,
    topics,
    captureCount: session.captures.length,
    hasPrivateNotes: Boolean(session.notes?.trim()),
    hasMeetNotes: Boolean(session.summary?.meetNotes?.trim()),
  })
  return {
    session: { id: session.id, occurredAt: session.occurredAt, privateNotes: session.notes ?? '' },
    member: { id: session.candidate.id, firstName: memberFirst, shared },
    coach: { firstName: firstNameOf(session.coach.fullName, 'Your coach') },
    captures: session.captures.map((c) => ({ ...c, kind: c.kind as CaptureKind })),
    summary: session.summary ? { text: session.summary.text, state: session.summary.state as 'DRAFT' | 'REVIEWED' | 'SENT', aiDrafted: session.summary.aiDrafted, sentAt: session.summary.sentAt, hasMeetNotes: Boolean(session.summary.meetNotes) } : null,
    followUps,
    topics,
    earlierOpen: earlierOpen.map((f) => ({ ...f, ownerKind: f.ownerKind as OwnerKind })),
    manifest,
    canFetchMeetNotes: true,
  }
}

/** The coach's sessions with one member, newest first, for the start card. */
export async function listSessionsForMember(coachId: string, candidateId: string) {
  const rows = await prisma.coachSession.findMany({
    where: { coachId, candidateId },
    orderBy: { occurredAt: 'desc' },
    take: 6,
    select: { id: true, occurredAt: true, summary: { select: { state: true } }, _count: { select: { captures: true } } },
  })
  return rows.map((r) => ({ id: r.id, occurredAt: r.occurredAt, state: (r.summary?.state ?? 'NONE') as 'NONE' | 'DRAFT' | 'REVIEWED' | 'SENT', captures: r._count.captures }))
}

// ── Captures and private notes ───────────────────────────────────────────────

export async function addCapture(coachId: string, sessionId: string, kind: unknown, text: unknown): Promise<Result<{ id: string }>> {
  const session = await ownedSession(coachId, sessionId)
  if (!session) return { ok: false, error: NOT_FOUND }
  if (isSent(session)) return { ok: false, error: ALREADY_SENT }
  if (!isCaptureKind(kind)) return { ok: false, error: 'Choose what you are capturing first: a win, blocker, decision or next step.' }
  const clean = cleanText(text, MAX_CAPTURE_CHARS)
  if (!clean) return { ok: false, error: `Write a line of up to ${MAX_CAPTURE_CHARS} characters, then add it.` }
  const row = await prisma.coachSessionCapture.create({ data: { sessionId, kind, text: clean }, select: { id: true } })
  captureServerEvent(coachId, 'coach_session_capture_added', { sessionId, candidateId: session.candidateId, kind })
  return { ok: true, id: row.id }
}

export async function removeCapture(coachId: string, sessionId: string, captureId: string): Promise<Result> {
  const session = await ownedSession(coachId, sessionId)
  if (!session) return { ok: false, error: NOT_FOUND }
  if (isSent(session)) return { ok: false, error: ALREADY_SENT }
  const r = await prisma.coachSessionCapture.deleteMany({ where: { id: captureId, sessionId } })
  if (r.count === 0) return { ok: false, error: 'That capture is already gone.' }
  captureServerEvent(coachId, 'coach_session_capture_removed', { sessionId, candidateId: session.candidateId })
  return { ok: true }
}

export async function savePrivateNotes(coachId: string, sessionId: string, text: unknown): Promise<Result> {
  const session = await ownedSession(coachId, sessionId)
  if (!session) return { ok: false, error: NOT_FOUND }
  const raw = typeof text === 'string' ? text.trim() : ''
  if (raw.length > MAX_PRIVATE_NOTES_CHARS) return { ok: false, error: `Private notes can be up to ${MAX_PRIVATE_NOTES_CHARS.toLocaleString('en-US')} characters. Yours are longer; shorten them and save again.` }
  await prisma.coachSession.update({ where: { id: sessionId }, data: { notes: raw || null } })
  captureServerEvent(coachId, 'coach_session_private_notes_saved', { sessionId, candidateId: session.candidateId, hasNotes: raw.length > 0 })
  return { ok: true }
}

// ── Imported notes ───────────────────────────────────────────────────────────

/**
 * Stores imported notes (Gemini notes read from the call, or notes the coach pasted) on the summary row, coach-only,
 * and proposes the next steps in them as follow-ups the coach can keep or remove. Nothing here reaches the member.
 */
export async function importNotes(coachId: string, sessionId: string, raw: unknown, source: 'meet' | 'paste'): Promise<Result<{ addedFollowUps: number }>> {
  const session = await ownedSession(coachId, sessionId)
  if (!session) return { ok: false, error: NOT_FOUND }
  if (isSent(session)) return { ok: false, error: ALREADY_SENT }
  const checked = checkImportedNotes(raw)
  if (!checked.ok) return checked
  await prisma.coachSessionSummary.upsert({
    where: { sessionId },
    create: { sessionId, meetNotes: checked.text },
    update: { meetNotes: checked.text },
  })
  const [coach, candidate] = await Promise.all([
    prisma.coach.findUniqueOrThrow({ where: { id: coachId }, select: { fullName: true } }),
    prisma.candidateProfile.findUniqueOrThrow({ where: { id: session.candidateId }, select: { firstName: true, lastName: true } }),
  ])
  const memberName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ')
  const proposed = followUpsFromNextSteps(parseNextSteps(checked.text, [coach.fullName]), [memberName, candidate.firstName ?? ''])
  const added = await addFollowUpsDeduped(session, proposed)
  captureServerEvent(coachId, 'coach_session_notes_imported', { sessionId, candidateId: session.candidateId, source, chars: checked.text.length, followUpsProposed: added })
  return { ok: true, addedFollowUps: added }
}

async function addFollowUpsDeduped(session: Pick<OwnedSession, 'id' | 'candidateId' | 'coachId'>, items: { ownerKind: OwnerKind; text: string }[]): Promise<number> {
  if (items.length === 0) return 0
  const existing = await prisma.coachFollowUp.findMany({ where: { sessionId: session.id }, select: { text: true } })
  const seen = new Set(existing.map((e) => e.text.trim().toLowerCase()))
  const fresh = items.filter((i) => {
    const key = i.text.trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (fresh.length === 0) return 0
  await prisma.coachFollowUp.createMany({ data: fresh.map((i) => ({ sessionId: session.id, candidateId: session.candidateId, coachId: session.coachId, ownerKind: i.ownerKind, text: i.text.slice(0, MAX_FOLLOW_UP_CHARS) })) })
  return fresh.length
}

// ── The summary text ─────────────────────────────────────────────────────────

/** The coach's own edit. Writing it is what makes it REVIEWED: the coach has put their hands on it. */
export async function saveSummary(coachId: string, sessionId: string, text: unknown): Promise<Result> {
  const session = await ownedSession(coachId, sessionId)
  if (!session) return { ok: false, error: NOT_FOUND }
  if (isSent(session)) return { ok: false, error: ALREADY_SENT }
  const raw = typeof text === 'string' ? text.replace(/\r\n/g, '\n').trim() : ''
  if (raw.length > MAX_SUMMARY_CHARS) return { ok: false, error: `The summary can be up to ${MAX_SUMMARY_CHARS.toLocaleString('en-US')} characters. Shorten it and save again; your text is still on the page.` }
  const state = raw ? 'REVIEWED' : 'DRAFT'
  await prisma.coachSessionSummary.upsert({
    where: { sessionId },
    create: { sessionId, text: raw, state, reviewedAt: raw ? new Date() : null },
    update: { text: raw, state, reviewedAt: raw ? new Date() : null },
  })
  captureServerEvent(coachId, 'coach_session_summary_saved', { sessionId, candidateId: session.candidateId, chars: raw.length, aiDrafted: session.summary?.aiDrafted ?? false })
  return { ok: true }
}

/** Used by the draft service: stores a model draft as DRAFT. The coach must still review and send it. */
export async function storeDraft(session: { id: string; candidateId: string; coachId: string }, draft: { summary: string; followUps: { owner: OwnerKind; text: string }[]; topics: { topic: string; quote: string }[] }): Promise<{ addedFollowUps: number; addedTopics: number }> {
  await prisma.coachSessionSummary.upsert({
    where: { sessionId: session.id },
    create: { sessionId: session.id, text: draft.summary, state: 'DRAFT', aiDrafted: true },
    update: { text: draft.summary, state: 'DRAFT', aiDrafted: true, reviewedAt: null },
  })
  const addedFollowUps = await addFollowUpsDeduped(session, draft.followUps.map((f) => ({ ownerKind: f.owner, text: f.text })))
  let addedTopics = 0
  for (const t of draft.topics) {
    if (!isTopicKey(t.topic)) continue
    const existing = await prisma.coachSessionTopic.findUnique({ where: { sessionId_topic: { sessionId: session.id, topic: t.topic } }, select: { id: true } })
    if (existing) continue
    await prisma.coachSessionTopic.create({ data: { sessionId: session.id, candidateId: session.candidateId, topic: t.topic, quote: t.quote.slice(0, 240) || null } })
    addedTopics++
  }
  return { addedFollowUps, addedTopics }
}

export async function loadDraftMaterial(coachId: string, sessionId: string) {
  const session = await prisma.coachSession.findFirst({
    where: { id: sessionId, coachId },
    select: {
      id: true,
      candidateId: true,
      coachId: true,
      captures: { orderBy: { createdAt: 'asc' }, select: { kind: true, text: true } },
      summary: { select: { text: true, state: true, meetNotes: true } },
      candidate: { select: { firstName: true } },
      coach: { select: { fullName: true } },
    },
  })
  return session
}

// ── Follow-ups ───────────────────────────────────────────────────────────────

export async function addFollowUp(coachId: string, sessionId: string, input: { ownerKind: unknown; text: unknown; dueOn?: unknown }): Promise<Result<{ id: string }>> {
  const session = await ownedSession(coachId, sessionId)
  if (!session) return { ok: false, error: NOT_FOUND }
  if (isSent(session)) return { ok: false, error: ALREADY_SENT }
  if (!isOwnerKind(input.ownerKind)) return { ok: false, error: 'Choose who owns this follow-up: you or your client.' }
  const text = cleanText(input.text, MAX_FOLLOW_UP_CHARS)
  if (!text) return { ok: false, error: `Write the follow-up in up to ${MAX_FOLLOW_UP_CHARS} characters, then add it.` }
  const dueRaw = typeof input.dueOn === 'string' ? input.dueOn : ''
  const dueOn = dueRaw ? parseDueOn(dueRaw) : null
  if (dueRaw && !dueOn) return { ok: false, error: 'That due date is not a real date. Pick one from the calendar, or leave it empty.' }
  const row = await prisma.coachFollowUp.create({ data: { sessionId, candidateId: session.candidateId, coachId, ownerKind: input.ownerKind, text, dueOn }, select: { id: true } })
  captureServerEvent(coachId, 'coach_follow_up_added', { sessionId, candidateId: session.candidateId, ownerKind: input.ownerKind, hasDueDate: dueOn !== null })
  return { ok: true, id: row.id }
}

export async function updateFollowUp(coachId: string, sessionId: string, followUpId: string, patch: { ownerKind?: unknown; dueOn?: unknown }): Promise<Result> {
  const session = await ownedSession(coachId, sessionId)
  if (!session) return { ok: false, error: NOT_FOUND }
  if (isSent(session)) return { ok: false, error: ALREADY_SENT }
  const data: Prisma.CoachFollowUpUpdateManyMutationInput = {}
  if (patch.ownerKind !== undefined) {
    if (!isOwnerKind(patch.ownerKind)) return { ok: false, error: 'Choose who owns this follow-up: you or your client.' }
    data.ownerKind = patch.ownerKind
  }
  if (patch.dueOn !== undefined) {
    const raw = typeof patch.dueOn === 'string' ? patch.dueOn : ''
    const due = raw ? parseDueOn(raw) : null
    if (raw && !due) return { ok: false, error: 'That due date is not a real date. Pick one from the calendar, or leave it empty.' }
    data.dueOn = due
  }
  const r = await prisma.coachFollowUp.updateMany({ where: { id: followUpId, sessionId }, data })
  if (r.count === 0) return { ok: false, error: 'That follow-up is already gone.' }
  captureServerEvent(coachId, 'coach_follow_up_changed', { sessionId, candidateId: session.candidateId, followUpId, ownerKind: patch.ownerKind ?? null, dueChanged: patch.dueOn !== undefined })
  return { ok: true }
}

export async function removeFollowUp(coachId: string, sessionId: string, followUpId: string): Promise<Result> {
  const session = await ownedSession(coachId, sessionId)
  if (!session) return { ok: false, error: NOT_FOUND }
  if (isSent(session)) return { ok: false, error: ALREADY_SENT }
  const r = await prisma.coachFollowUp.deleteMany({ where: { id: followUpId, sessionId } })
  if (r.count === 0) return { ok: false, error: 'That follow-up is already gone.' }
  captureServerEvent(coachId, 'coach_follow_up_removed', { sessionId, candidateId: session.candidateId, followUpId })
  return { ok: true }
}

/** The coach marks one of their own agreed follow-ups done (or open again), from any of their sessions with the member. */
export async function setCoachFollowUpDone(coachId: string, followUpId: string, done: boolean): Promise<Result> {
  const row = await prisma.coachFollowUp.findFirst({ where: { id: followUpId, coachId, ownerKind: 'coach' }, select: { id: true, sessionId: true, candidateId: true } })
  if (!row) return { ok: false, error: 'You can only tick off your own follow-ups.' }
  await prisma.coachFollowUp.update({ where: { id: row.id }, data: { status: done ? 'done' : 'open', completedAt: done ? new Date() : null } })
  captureServerEvent(coachId, done ? 'coach_follow_up_done' : 'coach_follow_up_reopened', { sessionId: row.sessionId, candidateId: row.candidateId, followUpId })
  return { ok: true }
}

// ── Topics (the coach's side) ────────────────────────────────────────────────

/** The coach confirms a suggested topic, adds one from the vocabulary, or takes a confirmation back. */
export async function setTopicConfirmed(coachId: string, sessionId: string, topic: string, confirmed: boolean): Promise<Result> {
  const session = await ownedSession(coachId, sessionId)
  if (!session) return { ok: false, error: NOT_FOUND }
  if (isSent(session)) return { ok: false, error: ALREADY_SENT }
  if (!isTopicKey(topic)) return { ok: false, error: 'That topic is not one we can use. Pick one from the list.' }
  const existing = await prisma.coachSessionTopic.findUnique({ where: { sessionId_topic: { sessionId, topic } } })
  const to: TopicStatus = confirmed ? 'confirmed' : 'suggested'
  if (existing) {
    if (existing.status === to) return { ok: true }
    if (!canMoveTopic(existing.status as TopicStatus, to, 'coach')) return { ok: false, error: 'This topic cannot change any more.' }
    await prisma.coachSessionTopic.update({ where: { id: existing.id }, data: { status: to, confirmedAt: confirmed ? new Date() : null } })
  } else {
    await prisma.coachSessionTopic.create({ data: { sessionId, candidateId: session.candidateId, topic, status: to, confirmedAt: confirmed ? new Date() : null } })
  }
  captureServerEvent(coachId, confirmed ? 'coach_topic_confirmed' : 'coach_topic_unconfirmed', { sessionId, candidateId: session.candidateId, topic, wasSuggested: Boolean(existing) })
  return { ok: true }
}

// ── Sending ──────────────────────────────────────────────────────────────────

/**
 * The one primary action. Marks the summary SENT, makes this session's follow-ups visible to the member (the
 * confirmed topics become theirs to accept or dismiss), puts the member's own to-dos in their weekly plan, and
 * emails a short notice that says there is an update and links to it, with no summary text. The in-app notice is
 * the Home note, which reads "sent and not yet viewed" (getUnviewedCoachUpdate).
 *
 * Idempotent: the state change is a conditional update, so a double click or a retry sends once.
 */
export async function sendToMember(coachId: string, sessionId: string): Promise<Result<{ memberTodos: number; coachFollowUps: number; confirmedTopics: number; emailed: boolean }>> {
  const session = await prisma.coachSession.findFirst({
    where: { id: sessionId, coachId },
    select: {
      id: true,
      candidateId: true,
      occurredAt: true,
      summary: { select: { id: true, state: true, text: true } },
      followUps: { select: { id: true, ownerKind: true, text: true, dueOn: true } },
      topics: { select: { status: true } },
      candidate: { select: { firstName: true, email: true, confidentialSearchMode: true } },
      coach: { select: { fullName: true } },
    },
  })
  if (!session) return { ok: false, error: NOT_FOUND }
  if (session.summary?.state === 'SENT') return { ok: false, error: 'You already sent this summary.' }
  const memberFirst = session.candidate.firstName?.trim() || 'your client'
  if (!session.summary?.text.trim()) return { ok: false, error: `Write or draft the summary first. ${memberFirst} gets nothing until you send it.` }

  const now = new Date()
  const claimed = await prisma.$transaction(async (tx) => {
    const flipped = await tx.coachSessionSummary.updateMany({
      where: { id: session.summary!.id, state: { not: 'SENT' } },
      data: { state: 'SENT', sentAt: now, reviewedAt: now },
    })
    if (flipped.count === 0) return false
    await tx.coachFollowUp.updateMany({ where: { sessionId }, data: { visibleToMemberAt: now } })
    return true
  })
  if (!claimed) return { ok: false, error: 'You already sent this summary.' }

  const memberTodos = session.followUps.filter((f) => f.ownerKind === 'member')
  const coachFollowUps = session.followUps.filter((f) => f.ownerKind === 'coach')
  const confirmedTopics = session.topics.filter((t) => t.status === 'confirmed').length

  // The to-dos are also in the member's weekly plan. If that fails the follow-ups are still on their coaching page.
  try {
    await pushFollowUpsToPlan(session.candidateId, sessionId, memberTodos)
  } catch (error) {
    console.error('Failed to add coach follow-ups to the weekly plan:', error)
  }

  const coachFirst = firstNameOf(session.coach.fullName, 'Your coach')
  let emailed = false
  if (session.candidate.email) {
    const r = await sendCoachUpdateEmail({
      to: session.candidate.email,
      memberFirstName: session.candidate.firstName,
      coachFirstName: coachFirst,
      confidential: session.candidate.confidentialSearchMode,
      // Confidential Search Mode: a link that does not say "coaching"; Home carries the notice.
      url: session.candidate.confidentialSearchMode ? `${APP_URL()}/dashboard` : `${APP_URL()}/dashboard/my-coaching`,
    })
    emailed = r.sent
  }

  captureServerEvent(coachId, 'coach_session_summary_sent', {
    sessionId,
    candidateId: session.candidateId,
    memberTodos: memberTodos.length,
    coachFollowUps: coachFollowUps.length,
    confirmedTopics,
    emailed,
    confidential: session.candidate.confidentialSearchMode,
  })
  return { ok: true, memberTodos: memberTodos.length, coachFollowUps: coachFollowUps.length, confirmedTopics, emailed }
}

/** Adds the member's own follow-ups to the current week's plan as to-dos, tagged so ticking one can close the follow-up. */
export async function pushFollowUpsToPlan(candidateId: string, sessionId: string, items: { id: string; text: string; dueOn: Date | null }[]): Promise<number> {
  if (items.length === 0) return 0
  const weekStartDate = getMondayOfWeek(new Date())
  const rows: CommittedAction[] = items.map((f) => ({
    text: planActionText(f.text, f.dueOn),
    points: 15,
    estimatedMinutes: 15,
    completed: false,
    recurring: false,
    addedFromCatalog: true,
    fromCoach: true,
    coachSessionId: sessionId,
    coachFollowUpId: f.id,
  }))
  const existing = await prisma.weeklySprint.findUnique({ where: { candidateId_weekStartDate: { candidateId, weekStartDate } } })
  if (!existing) {
    await prisma.weeklySprint.create({ data: { candidateId, weekStartDate, committedActions: rows as unknown as Prisma.InputJsonValue, autoAssigned: false } })
  } else {
    const actions = (existing.committedActions as unknown as CommittedAction[]) ?? []
    await prisma.weeklySprint.update({ where: { id: existing.id }, data: { committedActions: [...actions, ...rows] as unknown as Prisma.InputJsonValue } })
  }
  captureServerEvent(candidateId, 'coach_follow_ups_added_to_plan', { sessionId, count: rows.length })
  return rows.length
}

// ── The member's side ────────────────────────────────────────────────────────

export interface MemberCoachingView {
  coachFirstName: string
  sentAt: Date
  sessionId: string
  summaryId: string
  summaryText: string
  viewedAt: Date | null
  followUps: { id: string; ownerKind: OwnerKind; text: string; dueOn: Date | null; status: 'open' | 'done' }[]
  topics: { id: string; topic: string; label: string; effect: string; status: 'confirmed' | 'accepted' | 'dismissed' }[]
}

/**
 * What the member sees from their coach: the latest SENT summary with its follow-ups and topics. Everything is
 * filtered by "sent" here, in one place: a draft, a captured line, imported notes, private notes, an unconfirmed
 * topic or an unsent follow-up never leaves the database for a member.
 */
export async function getMemberCoachingView(candidateId: string): Promise<MemberCoachingView | null> {
  try {
    const session = await prisma.coachSession.findFirst({
      where: { candidateId, summary: { is: { state: 'SENT' } } },
      orderBy: { summary: { sentAt: 'desc' } },
      select: {
        id: true,
        coach: { select: { fullName: true } },
        summary: { select: { id: true, text: true, sentAt: true, viewedAt: true } },
        followUps: { where: { visibleToMemberAt: { not: null } }, orderBy: { createdAt: 'asc' }, select: { id: true, ownerKind: true, text: true, dueOn: true, status: true, visibleToMemberAt: true } },
        topics: { where: { status: { in: ['confirmed', 'accepted', 'dismissed'] } }, orderBy: { suggestedAt: 'asc' }, select: { id: true, topic: true, status: true } },
      },
    })
    if (!session?.summary?.sentAt) return null
    return {
      coachFirstName: firstNameOf(session.coach.fullName),
      sentAt: session.summary.sentAt,
      sessionId: session.id,
      summaryId: session.summary.id,
      summaryText: session.summary.text,
      viewedAt: session.summary.viewedAt,
      followUps: visibleToMember(session.followUps).map((f) => ({ id: f.id, ownerKind: f.ownerKind as OwnerKind, text: f.text, dueOn: f.dueOn, status: f.status as 'open' | 'done' })),
      topics: session.topics.flatMap((t) => {
        const def = topicByKey(t.topic)
        return def ? [{ id: t.id, topic: t.topic, label: def.label, effect: def.effect, status: t.status as 'confirmed' | 'accepted' | 'dismissed' }] : []
      }),
    }
  } catch (error) {
    // The tables may not exist yet; the coaching page must still load.
    console.error('Failed to load the member coaching view:', error)
    return null
  }
}

/** The in-app notice: a summary the coach sent that the member has not opened yet. Fail-soft. */
export async function getUnviewedCoachUpdate(candidateId: string): Promise<{ coachFirstName: string } | null> {
  try {
    const row = await prisma.coachSessionSummary.findFirst({
      where: { state: 'SENT', viewedAt: null, session: { candidateId } },
      orderBy: { sentAt: 'desc' },
      select: { session: { select: { coach: { select: { fullName: true } } } } },
    })
    return row ? { coachFirstName: firstNameOf(row.session.coach.fullName) } : null
  } catch {
    return null
  }
}

export async function markSummaryViewed(candidateId: string, summaryId: string): Promise<boolean> {
  const r = await prisma.coachSessionSummary.updateMany({ where: { id: summaryId, viewedAt: null, state: 'SENT', session: { candidateId } }, data: { viewedAt: new Date() } })
  if (r.count > 0) captureServerEvent(candidateId, 'coach_summary_viewed', { summaryId })
  return r.count > 0
}

/** The member accepts or dismisses a topic the coach confirmed. A suggested topic is never theirs to decide. */
export async function decideTopic(candidateId: string, topicId: string, decision: 'accepted' | 'dismissed'): Promise<Result> {
  const topic = await prisma.coachSessionTopic.findFirst({ where: { id: topicId, candidateId, session: { summary: { is: { state: 'SENT' } } } }, select: { id: true, topic: true, status: true, sessionId: true } })
  if (!topic) return { ok: false, error: 'We could not find that topic. Reload the page and try again.' }
  const from = topic.status as TopicStatus
  if (from === decision) return { ok: true }
  if (!canMoveTopic(from, decision, 'member')) return { ok: false, error: 'This topic is not ready for you to decide yet.' }
  await prisma.coachSessionTopic.update({
    where: { id: topic.id },
    data: decision === 'accepted' ? { status: 'accepted', acceptedAt: new Date(), dismissedAt: null } : { status: 'dismissed', dismissedAt: new Date(), acceptedAt: null },
  })
  captureServerEvent(candidateId, decision === 'accepted' ? 'coach_topic_accepted' : 'coach_topic_dismissed', { topicId: topic.id, topic: topic.topic, sessionId: topic.sessionId, from })
  return { ok: true }
}
