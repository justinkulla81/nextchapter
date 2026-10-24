'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCoachByToken, getCoachClient } from '@/lib/coach/access'
import { fetchMeetNotes } from '@/lib/coach/meet-notes'
import { draftSessionSummary } from '@/lib/coach/session-draft-service'
import {
  addCapture,
  addFollowUp,
  importNotes,
  removeCapture,
  removeFollowUp,
  saveSummary,
  savePrivateNotes,
  sendToMember,
  setCoachFollowUpDone,
  setTopicConfirmed,
  startSessionNotes,
  updateFollowUp,
  type Result,
} from '@/lib/coach/session-notes-service'

// Server actions for the coach's session notes page. Every one re-derives the coach from the URL token (the signed-in
// coach must own it), checks the client is theirs and the session is that client's, then calls the service, which
// scopes every row by coachId again. Each returns { ok } or { ok: false, error } in plain words and never throws
// at the page.

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

const INVALID = 'This link isn’t valid. Go back to your clients and open this one again.'

async function scoped(token: string, clientId: string, sessionId: string) {
  const coach = await getCoachByToken(token)
  if (!coach) return null
  const client = await getCoachClient(coach.id, clientId)
  if (!client) return null
  const session = await prisma.coachSession.findFirst({ where: { id: sessionId, coachId: coach.id, candidateId: client.id }, select: { id: true } })
  return session ? { coach, client } : null
}

const page = (token: string, clientId: string, sessionId: string) => `/support/coach/clients/${token}/${clientId}/notes/${sessionId}`

async function run<T extends object>(token: string, clientId: string, sessionId: string, fn: (coachId: string) => Promise<Result<T>>, message?: (r: T) => string | undefined): Promise<ActionResult> {
  const ctx = await scoped(token, clientId, sessionId)
  if (!ctx) return { ok: false, error: INVALID }
  try {
    const r = await fn(ctx.coach.id)
    if (!r.ok) return { ok: false, error: r.error }
    revalidatePath(page(token, clientId, sessionId))
    revalidatePath(`/support/coach/clients/${token}/${clientId}`)
    return { ok: true, message: message?.(r) }
  } catch (error) {
    console.error('Coach session notes action failed:', error)
    return { ok: false, error: 'Something went wrong on our side and nothing was lost. Try again in a moment.' }
  }
}

/** Starts the notes for a session happening now, then opens them. Used by the "Start notes" button on the brief. */
export async function startSessionNotesAction(token: string, clientId: string): Promise<ActionResult> {
  const coach = await getCoachByToken(token)
  if (!coach) return { ok: false, error: INVALID }
  const client = await getCoachClient(coach.id, clientId)
  if (!client) return { ok: false, error: INVALID }
  let sessionId: string
  try {
    const r = await startSessionNotes(coach.id, client.id)
    if (!r.ok) return { ok: false, error: r.error }
    sessionId = r.sessionId
  } catch (error) {
    console.error('Failed to start session notes:', error)
    return { ok: false, error: 'We could not start the notes just now. Nothing was saved. Try again in a moment.' }
  }
  revalidatePath(`/support/coach/clients/${token}/${clientId}`)
  redirect(page(token, clientId, sessionId))
}

export async function addCaptureAction(token: string, clientId: string, sessionId: string, kind: string, text: string) {
  return run(token, clientId, sessionId, (coachId) => addCapture(coachId, sessionId, kind, text))
}

export async function removeCaptureAction(token: string, clientId: string, sessionId: string, captureId: string) {
  return run(token, clientId, sessionId, (coachId) => removeCapture(coachId, sessionId, captureId))
}

export async function savePrivateNotesAction(token: string, clientId: string, sessionId: string, text: string) {
  return run(token, clientId, sessionId, (coachId) => savePrivateNotes(coachId, sessionId, text), () => 'Private notes saved.')
}

/** Reads Gemini's notes for the booked call (never the transcript) and adds them to this session, coach-only. */
export async function fetchMeetNotesAction(token: string, clientId: string, sessionId: string) {
  return run(
    token,
    clientId,
    sessionId,
    async (coachId) => {
      const session = await prisma.coachSession.findFirstOrThrow({ where: { id: sessionId, coachId }, select: { occurredAt: true, candidateId: true } })
      const notes = await fetchMeetNotes(coachId, session.candidateId, session.occurredAt)
      if (!notes.ok) return { ok: false as const, error: notes.message }
      return importNotes(coachId, sessionId, notes.text, 'meet')
    },
    (r) => (r.addedFollowUps > 0 ? `Notes added. ${r.addedFollowUps} follow-up${r.addedFollowUps === 1 ? '' : 's'} found in them.` : 'Notes added.'),
  )
}

export async function pasteNotesAction(token: string, clientId: string, sessionId: string, text: string) {
  return run(token, clientId, sessionId, (coachId) => importNotes(coachId, sessionId, text, 'paste'), (r) => (r.addedFollowUps > 0 ? `Notes added. ${r.addedFollowUps} follow-up${r.addedFollowUps === 1 ? '' : 's'} found in them.` : 'Notes added.'))
}

export async function saveSummaryAction(token: string, clientId: string, sessionId: string, text: string) {
  return run(token, clientId, sessionId, (coachId) => saveSummary(coachId, sessionId, text), () => 'Summary saved.')
}

export async function draftSummaryAction(token: string, clientId: string, sessionId: string, replace: boolean) {
  return run(token, clientId, sessionId, (coachId) => draftSessionSummary(coachId, sessionId, { replace }), () => 'Draft ready. Read it and edit anything. Nothing is sent.')
}

export async function addFollowUpAction(token: string, clientId: string, sessionId: string, ownerKind: string, text: string, dueOn: string) {
  return run(token, clientId, sessionId, (coachId) => addFollowUp(coachId, sessionId, { ownerKind, text, dueOn }))
}

export async function updateFollowUpAction(token: string, clientId: string, sessionId: string, followUpId: string, patch: { ownerKind?: string; dueOn?: string }) {
  return run(token, clientId, sessionId, (coachId) => updateFollowUp(coachId, sessionId, followUpId, patch))
}

export async function removeFollowUpAction(token: string, clientId: string, sessionId: string, followUpId: string) {
  return run(token, clientId, sessionId, (coachId) => removeFollowUp(coachId, sessionId, followUpId))
}

export async function setCoachFollowUpDoneAction(token: string, clientId: string, sessionId: string, followUpId: string, done: boolean) {
  return run(token, clientId, sessionId, (coachId) => setCoachFollowUpDone(coachId, followUpId, done))
}

export async function setTopicAction(token: string, clientId: string, sessionId: string, topic: string, confirmed: boolean) {
  return run(token, clientId, sessionId, (coachId) => setTopicConfirmed(coachId, sessionId, topic, confirmed))
}

export async function sendToMemberAction(token: string, clientId: string, sessionId: string) {
  return run(token, clientId, sessionId, (coachId) => sendToMember(coachId, sessionId), (r) => (r.emailed ? 'Sent. They have it in their plan and by email.' : 'Sent. They have it in their plan. The email notice could not be sent just now.'))
}
