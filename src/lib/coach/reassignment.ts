import 'server-only'
import { Prisma, type ReassignmentRequestedBy } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getLatestDimensionSnapshot } from '@/lib/coach/dimension-history'
import { captureServerEvent } from '@/lib/posthog/server'

export interface HandoffSummary {
  generatedAt: string
  dimensions: { key: string; status: string | null; trend: string | null; note: string | null }[]
  recentSessions: {
    occurredAt: string
    notes: string | null
    directives: string | null
    focusNote: string | null
  }[]
}

// §A5.4 handoff artifact — "using the structured session notes from §A5.1
// as the handoff artifact." A real snapshot at the moment reassignment
// completes: the candidate's latest dimension read plus their last 5
// sessions' notes/directives/focus, so the receiving coach has an actual
// clean starting point instead of a bare name.
async function buildHandoffSummary(candidateId: string): Promise<HandoffSummary> {
  const [dimensions, recentSessions] = await Promise.all([
    getLatestDimensionSnapshot(candidateId),
    prisma.coachSession.findMany({
      where: { candidateId },
      orderBy: { occurredAt: 'desc' },
      take: 5,
      select: { occurredAt: true, notes: true, directives: true, focusNote: true },
    }),
  ])

  return {
    generatedAt: new Date().toISOString(),
    dimensions: dimensions.map((d) => ({ key: d.key, status: d.status, trend: d.trend, note: d.note })),
    recentSessions: recentSessions.map((s) => ({
      occurredAt: s.occurredAt.toISOString(),
      notes: s.notes,
      directives: s.directives,
      focusNote: s.focusNote,
    })),
  }
}

// §A5.4 "one-tap reassignment request from either side, no blame" — either
// a coach or a candidate can open one; it always lands PENDING for admin to
// route (never self-serve reassignment), matching the spec's "admin
// routes."
export async function requestReassignment(params: {
  candidateId: string
  requestedBy: ReassignmentRequestedBy
  fromCoachId: string | null
  reason: string | null
}) {
  const request = await prisma.coachReassignmentRequest.create({
    data: {
      candidateId: params.candidateId,
      fromCoachId: params.fromCoachId,
      requestedBy: params.requestedBy,
      reason: params.reason,
    },
  })
  captureServerEvent(params.candidateId, 'coach_reassignment_requested', {
    requestId: request.id,
    requestedBy: params.requestedBy,
  })
  return request
}

// Admin routes a pending request (or initiates a departure transfer
// directly — see adminTransferClient below) to a specific new coach. This
// is the one legitimate path that changes CandidateProfile.coachId after
// creation — see that field's schema comment.
export async function completeReassignment(requestId: string, toCoachId: string, resolvedBy: string) {
  const request = await prisma.coachReassignmentRequest.findUniqueOrThrow({ where: { id: requestId } })
  const handoffSummary = await buildHandoffSummary(request.candidateId)

  const [, updated] = await prisma.$transaction([
    prisma.candidateProfile.update({ where: { id: request.candidateId }, data: { coachId: toCoachId } }),
    prisma.coachReassignmentRequest.update({
      where: { id: requestId },
      data: {
        toCoachId,
        status: 'COMPLETED',
        resolvedAt: new Date(),
        resolvedBy,
        handoffSummary: handoffSummary as unknown as Prisma.InputJsonValue,
      },
    }),
  ])

  captureServerEvent(resolvedBy, 'coach_reassignment_completed', {
    requestId,
    candidateId: request.candidateId,
    fromCoachId: request.fromCoachId,
    toCoachId,
  })

  return updated
}

export async function declineReassignment(requestId: string, resolvedBy: string, note: string | null) {
  const updated = await prisma.coachReassignmentRequest.update({
    where: { id: requestId },
    data: { status: 'DECLINED', resolvedAt: new Date(), resolvedBy, reason: note ?? undefined },
  })
  captureServerEvent(resolvedBy, 'coach_reassignment_declined', { requestId })
  return updated
}

// §A5.4 coach-departure handoff — admin picks a candidate + outgoing coach +
// incoming coach and transfers in one step, generating the same handoff
// artifact a routed one-tap request would. Creates its own
// CoachReassignmentRequest row (requestedBy ADMIN) so this always leaves the
// same audit trail as the mismatch flow, rather than mutating coachId
// directly with no record.
export async function adminTransferClient(params: {
  candidateId: string
  fromCoachId: string | null
  toCoachId: string
  reason: string | null
  actor: string
}) {
  const request = await prisma.coachReassignmentRequest.create({
    data: {
      candidateId: params.candidateId,
      fromCoachId: params.fromCoachId,
      requestedBy: 'ADMIN',
      reason: params.reason,
    },
  })
  return completeReassignment(request.id, params.toCoachId, params.actor)
}
