import 'server-only'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateUpload } from '@/lib/uploads/validate-upload'
import { CANDIDATE_ACTION_STATUSES, CANCELLABLE_STATUSES, OPEN_STATUSES, UPLOADABLE_STATUSES, candidateCanUpload, isDocumentStatus, requesterCanCancel, requesterCanReview, type DocumentStatus } from '@/lib/documents/status'

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
}): Promise<Result<{ id: string; title: string; instructions: string | null }>> {
  const title = input.title.trim().slice(0, 150)
  if (!title) return { ok: false, error: 'Say what you are asking for, for example “Signed offer letter”.' }
  const open = await prisma.documentRequest.count({ where: { candidateId: input.candidateId, status: { in: OPEN_STATUSES } } })
  if (open >= MAX_OPEN_REQUESTS_PER_CANDIDATE) {
    return { ok: false, error: 'This person already has a lot of open requests. Wait for some to be completed, or cancel ones you no longer need.' }
  }
  const instructions = input.instructions?.trim().slice(0, 2000) || null
  const request = await prisma.documentRequest.create({
    data: {
      candidateId: input.candidateId,
      requesterType: input.requester.type,
      requesterId: input.requester.id,
      requesterLabel: input.requester.label.slice(0, 150),
      title,
      instructions,
      dueAt: input.dueAt,
    },
    select: { id: true },
  })
  return { ok: true, id: request.id, title, instructions }
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
  // Guarded on the status we read: if the requester accepted or cancelled in the meantime, this changes
  // nothing and the file we just stored is removed, rather than overwriting their decision.
  const updated = await prisma.documentRequest.updateMany({
    where: { id: request.id, candidateId, status: { in: UPLOADABLE_STATUSES } },
    data: {
      filePath: path,
      fileName: file.name.slice(0, 200),
      contentType: check.contentType,
      sizeBytes: file.size,
      uploadedAt: new Date(),
      status: 'UPLOADED',
      reviewedAt: null,
      reviewNote: null,
    },
  })
  if (updated.count === 0) {
    await admin.storage.from(DOCUMENT_BUCKET).remove([path]).catch(() => {})
    return { ok: false, error: 'This request changed while you were uploading, so your file was not saved. Reload the page to see where it stands.' }
  }
  // The old file is no longer referenced; remove it so replaced documents don't pile up.
  if (request.filePath) await admin.storage.from(DOCUMENT_BUCKET).remove([request.filePath]).catch(() => {})
  return { ok: true, replaced, sizeBytes: file.size, contentType: check.contentType }
}

/** Requester accepts the file or asks for a new one. `candidateId` ties the request to the client being viewed. */
export async function reviewRequestedDocument(requester: Requester, candidateId: string, requestId: string, outcome: 'ACCEPTED' | 'NEEDS_CHANGES', note: string | null): Promise<Result<{ candidateId: string }>> {
  const request = await prisma.documentRequest.findFirst({ where: { id: requestId, candidateId, requesterType: requester.type, requesterId: requester.id } })
  if (!request) return { ok: false, error: 'We could not find this request. Reload the page and try again.' }
  if (!requesterCanReview(statusOf(request.status))) return { ok: false, error: 'There is no uploaded file waiting for review on this request.' }
  const reviewNote = note?.trim().slice(0, 2000) || null
  if (outcome === 'NEEDS_CHANGES' && !reviewNote) return { ok: false, error: 'Say what needs to change so they know what to upload.' }
  // Guarded on the file we looked at: if the candidate replaced it meanwhile, this does not accept the new one unseen.
  const updated = await prisma.documentRequest.updateMany({
    where: { id: request.id, status: 'UPLOADED', filePath: request.filePath },
    data: { status: outcome, reviewedAt: new Date(), reviewNote },
  })
  if (updated.count === 0) return { ok: false, error: 'The file changed while you were reviewing it. Reload the page and look at the new one.' }
  return { ok: true, candidateId: request.candidateId }
}

export async function cancelDocumentRequest(requester: Requester, candidateId: string, requestId: string): Promise<Result<{ candidateId: string }>> {
  const request = await prisma.documentRequest.findFirst({ where: { id: requestId, candidateId, requesterType: requester.type, requesterId: requester.id } })
  if (!request) return { ok: false, error: 'We could not find this request. Reload the page and try again.' }
  if (!requesterCanCancel(statusOf(request.status))) return { ok: false, error: 'This request is already finished, so it cannot be cancelled.' }
  const updated = await prisma.documentRequest.updateMany({ where: { id: request.id, status: { in: CANCELLABLE_STATUSES } }, data: { status: 'CANCELLED' } })
  if (updated.count === 0) return { ok: false, error: 'This request was just finished, so it cannot be cancelled.' }
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
export async function requesterDocumentUrl(requester: Requester, candidateId: string, requestId: string): Promise<string | null> {
  const r = await prisma.documentRequest.findFirst({ where: { id: requestId, candidateId, requesterType: requester.type, requesterId: requester.id }, select: { filePath: true } })
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
    return await prisma.documentRequest.count({ where: { candidateId, status: { in: CANDIDATE_ACTION_STATUSES } } })
  } catch (error) {
    console.error('Failed to count open document requests for nav badge:', error)
    return 0
  }
}
