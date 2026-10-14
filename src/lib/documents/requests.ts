import 'server-only'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateUpload } from '@/lib/uploads/validate-upload'
import { candidateCanUpload, isDocumentStatus, needsCandidateAction, requesterCanCancel, requesterCanReview, type DocumentStatus } from '@/lib/documents/status'

export const DOCUMENT_BUCKET = 'requested-documents'
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
const SIGNED_URL_SECONDS = 60 * 10
const MAX_OPEN_REQUESTS_PER_CANDIDATE = 25

export type Requester = { type: 'COACH' | 'INSTITUTION' | 'EMPLOYER' | 'ADMIN'; id: string; label: string }
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

const statusOf = (value: string): DocumentStatus => (isDocumentStatus(value) ? value : 'REQUESTED')

export async function createDocumentRequest(input: {
  requester: Requester
  candidateId: string
  title: string
  instructions: string | null
  dueAt: Date | null
}): Promise<Result<{ id: string }>> {
  const title = input.title.trim().slice(0, 150)
  if (!title) return { ok: false, error: 'Say what you are asking for, for example “Signed offer letter”.' }
  const open = await prisma.documentRequest.count({ where: { candidateId: input.candidateId, status: { in: ['REQUESTED', 'UPLOADED', 'NEEDS_CHANGES'] } } })
  if (open >= MAX_OPEN_REQUESTS_PER_CANDIDATE) {
    return { ok: false, error: 'This person already has a lot of open requests. Wait for some to be completed, or cancel ones you no longer need.' }
  }
  const request = await prisma.documentRequest.create({
    data: {
      candidateId: input.candidateId,
      requesterType: input.requester.type,
      requesterId: input.requester.id,
      requesterLabel: input.requester.label.slice(0, 150),
      title,
      instructions: input.instructions?.trim().slice(0, 2000) || null,
      dueAt: input.dueAt,
    },
    select: { id: true },
  })
  return { ok: true, id: request.id }
}

/** Candidate adds or replaces the file. The request must be theirs and still open. */
export async function uploadRequestedDocument(candidateId: string, requestId: string, file: File | null): Promise<Result<{ replaced: boolean; sizeBytes: number; contentType: string }>> {
  if (!file || file.size === 0) return { ok: false, error: 'Choose a file to upload first.' }
  const request = await prisma.documentRequest.findFirst({ where: { id: requestId, candidateId } })
  if (!request) return { ok: false, error: 'We could not find this request. Reload the page and try again.' }
  if (!candidateCanUpload(statusOf(request.status))) {
    return { ok: false, error: request.status === 'ACCEPTED' ? 'This document was already accepted, so it can no longer be changed.' : 'This request was cancelled, so it no longer needs a file.' }
  }

  const check = await validateUpload(file, 'requestedDocument', MAX_DOCUMENT_BYTES)
  if (!check.ok) return { ok: false, error: check.error }

  const admin = createAdminClient()
  const path = `${candidateId}/${requestId}/${crypto.randomUUID()}.${check.ext}`
  const { error: uploadError } = await admin.storage.from(DOCUMENT_BUCKET).upload(path, file, { contentType: check.contentType })
  if (uploadError) return { ok: false, error: 'Something went wrong uploading your file. Please try again.' }

  const replaced = Boolean(request.filePath)
  await prisma.documentRequest.update({
    where: { id: request.id },
    data: {
      filePath: path,
      fileName: file.name.slice(0, 200),
      contentType: check.contentType,
      sizeBytes: file.size,
      uploadedAt: new Date(),
      status: 'UPLOADED',
      reviewedAt: null,
    },
  })
  // The old file is no longer referenced; remove it so replaced documents don't pile up.
  if (request.filePath) await admin.storage.from(DOCUMENT_BUCKET).remove([request.filePath]).catch(() => {})
  return { ok: true, replaced, sizeBytes: file.size, contentType: check.contentType }
}

/** Requester accepts the file or asks for a new one. */
export async function reviewRequestedDocument(requester: Requester, requestId: string, outcome: 'ACCEPTED' | 'NEEDS_CHANGES', note: string | null): Promise<Result<{ candidateId: string }>> {
  const request = await prisma.documentRequest.findFirst({ where: { id: requestId, requesterType: requester.type, requesterId: requester.id } })
  if (!request) return { ok: false, error: 'We could not find this request. Reload the page and try again.' }
  if (!requesterCanReview(statusOf(request.status))) return { ok: false, error: 'There is no uploaded file waiting for review on this request.' }
  const reviewNote = note?.trim().slice(0, 2000) || null
  if (outcome === 'NEEDS_CHANGES' && !reviewNote) return { ok: false, error: 'Say what needs to change so they know what to upload.' }
  await prisma.documentRequest.update({ where: { id: request.id }, data: { status: outcome, reviewedAt: new Date(), reviewNote } })
  return { ok: true, candidateId: request.candidateId }
}

export async function cancelDocumentRequest(requester: Requester, requestId: string): Promise<Result<{ candidateId: string }>> {
  const request = await prisma.documentRequest.findFirst({ where: { id: requestId, requesterType: requester.type, requesterId: requester.id } })
  if (!request) return { ok: false, error: 'We could not find this request. Reload the page and try again.' }
  if (!requesterCanCancel(statusOf(request.status))) return { ok: false, error: 'This request is already finished, so it cannot be cancelled.' }
  await prisma.documentRequest.update({ where: { id: request.id }, data: { status: 'CANCELLED' } })
  return { ok: true, candidateId: request.candidateId }
}

async function signedUrl(filePath: string | null): Promise<string | null> {
  if (!filePath) return null
  const { data } = await createAdminClient().storage.from(DOCUMENT_BUCKET).createSignedUrl(filePath, SIGNED_URL_SECONDS)
  return data?.signedUrl ?? null
}

/** Short-lived link to the file, for the candidate it belongs to. */
export async function candidateDocumentUrl(candidateId: string, requestId: string): Promise<string | null> {
  const r = await prisma.documentRequest.findFirst({ where: { id: requestId, candidateId }, select: { filePath: true } })
  return signedUrl(r?.filePath ?? null)
}

/** Short-lived link to the file, for the requester who asked for it. */
export async function requesterDocumentUrl(requester: Requester, requestId: string): Promise<string | null> {
  const r = await prisma.documentRequest.findFirst({ where: { id: requestId, requesterType: requester.type, requesterId: requester.id }, select: { filePath: true } })
  return signedUrl(r?.filePath ?? null)
}

export async function listCandidateRequests(candidateId: string) {
  return prisma.documentRequest.findMany({
    where: { candidateId, status: { not: 'CANCELLED' } },
    orderBy: [{ createdAt: 'desc' }],
  })
}

export async function listRequesterRequests(requester: Requester, candidateId: string) {
  return prisma.documentRequest.findMany({
    where: { candidateId, requesterType: requester.type, requesterId: requester.id },
    orderBy: [{ createdAt: 'desc' }],
  })
}

/**
 * How many requests are waiting on this candidate, for the nav badge. The badge is
 * decoration, so a failure (for example the table not created yet) is a quiet zero.
 */
export async function countOpenRequestsForCandidate(candidateId: string): Promise<number> {
  try {
    const rows = await prisma.documentRequest.findMany({ where: { candidateId, status: { in: ['REQUESTED', 'NEEDS_CHANGES'] } }, select: { status: true } })
    return rows.filter((r) => needsCandidateAction(statusOf(r.status))).length
  } catch (error) {
    console.error('Failed to count open document requests for nav badge:', error)
    return 0
  }
}
