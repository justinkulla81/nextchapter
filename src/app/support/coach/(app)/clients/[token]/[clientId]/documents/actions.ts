'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCoachByToken, getCoachClient } from '@/lib/coach/access'
import { captureServerEvent } from '@/lib/posthog/server'
import { cancelDocumentRequest, createDocumentRequest, requesterDocumentUrl, reviewRequestedDocument, type Requester } from '@/lib/documents/requests'
import { sendDocumentRequestedEmail } from '@/lib/email/send-document-requested'

export type CoachDocumentState = { error?: string; message?: string } | undefined

async function scope(token: string, clientId: string) {
  const coach = await getCoachByToken(token)
  if (!coach) return null
  const client = await getCoachClient(coach.id, clientId)
  if (!client) return null
  const requester: Requester = { type: 'COACH', id: coach.id, label: coach.firmName ? `${coach.fullName} (${coach.firmName})` : coach.fullName }
  return { coach, client, requester }
}

const INVALID = { error: 'This link isn’t valid. Go back to your clients and open this one again.' }

export async function requestDocument(token: string, clientId: string, _prev: CoachDocumentState, formData: FormData): Promise<CoachDocumentState> {
  const s = await scope(token, clientId)
  if (!s) return INVALID

  const dueRaw = String(formData.get('dueAt') ?? '').trim()
  const dueAt = dueRaw ? new Date(`${dueRaw}T23:59:59`) : null
  if (dueAt && Number.isNaN(dueAt.getTime())) return { error: 'That due date is not valid. Pick a date from the calendar or leave it blank.' }

  const created = await createDocumentRequest({
    requester: s.requester,
    candidateId: s.client.id,
    title: String(formData.get('title') ?? ''),
    instructions: String(formData.get('instructions') ?? '') || null,
    dueAt,
  })
  if (!created.ok) return { error: created.error }

  captureServerEvent(s.coach.id, 'document_requested', {
    requestId: created.id,
    candidateId: s.client.id,
    requesterType: 'COACH',
    requesterId: s.coach.id,
    hasDueDate: dueAt !== null,
  })

  // Tell the client. If they have no email on file the request still shows on their dashboard.
  let emailed = false
  if (s.client.email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const title = String(formData.get('title') ?? '').trim().slice(0, 150)
    const result = await sendDocumentRequestedEmail({
      to: s.client.email,
      requesterLabel: s.requester.label,
      title,
      instructions: String(formData.get('instructions') ?? '').trim().slice(0, 2000) || null,
      dueAt,
      uploadUrl: `${appUrl}/dashboard/documents`,
    })
    emailed = result.sent
  }

  revalidatePath(`/support/coach/clients/${token}/${clientId}/documents`)
  return { message: emailed ? 'Requested. We emailed them.' : 'Requested. We could not email them, so they will see it the next time they open their dashboard.' }
}

export async function reviewDocument(token: string, clientId: string, requestId: string, outcome: 'ACCEPTED' | 'NEEDS_CHANGES', _prev: CoachDocumentState, formData: FormData): Promise<CoachDocumentState> {
  const s = await scope(token, clientId)
  if (!s) return INVALID
  // The request must belong to this client, not just to this coach.
  const owns = await prisma.documentRequest.findFirst({ where: { id: requestId, candidateId: s.client.id }, select: { id: true } })
  if (!owns) return INVALID
  const result = await reviewRequestedDocument(s.requester, requestId, outcome, String(formData.get('note') ?? ''))
  if (!result.ok) return { error: result.error }
  captureServerEvent(s.coach.id, 'document_reviewed', { requestId, candidateId: s.client.id, outcome, requesterType: 'COACH', hasNote: Boolean(String(formData.get('note') ?? '').trim()) })
  revalidatePath(`/support/coach/clients/${token}/${clientId}/documents`)
  return { message: outcome === 'ACCEPTED' ? 'Accepted.' : 'Sent back with your note.' }
}

export async function cancelRequest(token: string, clientId: string, requestId: string): Promise<CoachDocumentState> {
  const s = await scope(token, clientId)
  if (!s) return INVALID
  const owns = await prisma.documentRequest.findFirst({ where: { id: requestId, candidateId: s.client.id }, select: { id: true } })
  if (!owns) return INVALID
  const result = await cancelDocumentRequest(s.requester, requestId)
  if (!result.ok) return { error: result.error }
  captureServerEvent(s.coach.id, 'document_request_cancelled', { requestId, candidateId: s.client.id, requesterType: 'COACH' })
  revalidatePath(`/support/coach/clients/${token}/${clientId}/documents`)
  return { message: 'Cancelled.' }
}

export async function getClientDocumentUrl(token: string, clientId: string, requestId: string): Promise<string | null> {
  const s = await scope(token, clientId)
  if (!s) return null
  const owns = await prisma.documentRequest.findFirst({ where: { id: requestId, candidateId: s.client.id }, select: { id: true } })
  if (!owns) return null
  const url = await requesterDocumentUrl(s.requester, requestId)
  if (url) captureServerEvent(s.coach.id, 'document_opened', { requestId, candidateId: s.client.id, by: 'coach' })
  return url
}
