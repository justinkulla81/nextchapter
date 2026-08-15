import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import type { CurrentOutplacementOrgUser } from '@/lib/employer/outplacement-auth'

// The org's own enrollment roster — READS ONLY OutplacementSeat's own
// invitedEmail/invitedName/status/date columns, never CandidateProfile.
// See the model's own comment in prisma/schema.prisma for why redisplaying
// an org's own enrollment input back to them (fields the employer_admin
// typed in themselves) isn't the same privacy violation as resolving an
// arbitrary candidate's identity from aggregate data — this file never
// selects candidateId's related CandidateProfile fields, so there is no
// grade/activity/detection/mood data reachable from here even by accident.
//
// One deliberate exception, enforced below: spec §A1.2.4 — "A candidate
// who is also an org user never sees their own record from the org side."
// If this org happens to have a seat whose linked candidate is the exact
// person viewing this roster (e.g. an assistant enrolled them, or they
// were enrolled before becoming an org user themselves), that row's name/
// email/detail is redacted for THIS VIEWER specifically — even though they
// technically already know who they are, the rule is unconditional.

export interface RosterSeat {
  id: string
  contractId: string
  invitedEmail: string
  invitedName: string | null
  status: 'INVITED' | 'ACTIVATED' | 'DEACTIVATED'
  enrollmentMethod: 'SINGLE' | 'BULK_CSV'
  enrolledAt: Date
  activatedAt: Date | null
  placedAt: Date | null
  isSelf: boolean
}

export async function getOrgRoster(orgUser: CurrentOutplacementOrgUser, contractId?: string): Promise<RosterSeat[]> {
  // The one CandidateProfile touch in this whole file — a single-row
  // lookup keyed on the VIEWER's own userId, used only for the equality
  // check below. Never selects or returns anything about any candidate
  // other than "does this id equal the viewer's own."
  const ownCandidate = await prisma.candidateProfile.findUnique({
    where: { userId: orgUser.userId },
    select: { id: true },
  })

  const seats = await prisma.outplacementSeat.findMany({
    where: { contract: { orgId: orgUser.orgId }, ...(contractId ? { contractId } : {}) },
    select: {
      id: true,
      contractId: true,
      invitedEmail: true,
      invitedName: true,
      status: true,
      enrollmentMethod: true,
      enrolledAt: true,
      activatedAt: true,
      placedAt: true,
      candidateId: true,
    },
    orderBy: { enrolledAt: 'desc' },
  })

  return seats.map((s) => {
    const isSelf = !!ownCandidate && s.candidateId === ownCandidate.id
    return {
      id: s.id,
      contractId: s.contractId,
      invitedEmail: isSelf ? 'Restricted — your own record' : s.invitedEmail,
      invitedName: isSelf ? null : s.invitedName,
      status: s.status,
      enrollmentMethod: s.enrollmentMethod,
      enrolledAt: s.enrolledAt,
      activatedAt: isSelf ? null : s.activatedAt,
      placedAt: isSelf ? null : s.placedAt,
      isSelf,
    }
  })
}

export async function markSeatPlaced(orgUser: CurrentOutplacementOrgUser, seatId: string): Promise<{ error?: string }> {
  const seat = await prisma.outplacementSeat.findFirst({
    where: { id: seatId, contract: { orgId: orgUser.orgId } },
    select: { id: true, status: true },
  })
  if (!seat) return { error: 'Seat not found.' }
  if (seat.status !== 'ACTIVATED') return { error: 'Only an activated seat can be marked placed.' }

  await prisma.outplacementSeat.update({ where: { id: seatId }, data: { placedAt: new Date() } })
  captureServerEvent(orgUser.userId, 'outplacement_seat_marked_placed', { orgId: orgUser.orgId, seatId })
  return {}
}

export async function deactivateSeat(orgUser: CurrentOutplacementOrgUser, seatId: string): Promise<{ error?: string }> {
  const seat = await prisma.outplacementSeat.findFirst({
    where: { id: seatId, contract: { orgId: orgUser.orgId } },
    select: { id: true, status: true },
  })
  if (!seat) return { error: 'Seat not found.' }
  if (seat.status === 'DEACTIVATED') return { error: 'This seat is already deactivated.' }

  await prisma.outplacementSeat.update({
    where: { id: seatId },
    data: { status: 'DEACTIVATED', deactivatedAt: new Date() },
  })
  captureServerEvent(orgUser.userId, 'outplacement_seat_deactivated', { orgId: orgUser.orgId, seatId })
  return {}
}
