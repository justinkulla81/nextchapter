import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import type { CurrentOutplacementOrgUser } from '@/lib/employer/outplacement-auth'
import { grantSeatAccess, revokeSeatAccess, seatGrants, setGrantSessions, setSeatFeature, type Feature } from '@/lib/access/grants'

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
  enrollmentMethod: 'SINGLE' | 'BULK_CSV' | 'API'
  externalId: string | null
  cohort: string | null
  enrolledAt: Date
  activatedAt: Date | null
  placedAt: Date | null
  packageKey: string | null
  isSelf: boolean
  // What this seat unlocks from NextChapter. Allotted sessions only, never
  // how many were used: that would be activity.
  access: { coaching: { on: boolean; sessions: number | null } | null; recruiters: boolean | null; endsAt: Date | null }
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
      packageKey: true,
      candidateId: true,
      accessEndsAt: true,
      externalId: true,
      cohort: true,
      contract: { select: { termEndAt: true } },
    },
    orderBy: { enrolledAt: 'desc' },
  })
  const grants = await seatGrants(seats.map((s) => s.id))

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
      packageKey: s.packageKey,
      externalId: isSelf ? null : s.externalId,
      cohort: s.cohort,
      isSelf,
      access: (() => {
        const g = grants.get(s.id) ?? []
        const c = g.find((x) => x.feature === 'coaching')
        const r = g.find((x) => x.feature === 'recruiters')
        return {
          coaching: c ? { on: !c.revokedAt, sessions: c.sessionsTotal } : null,
          recruiters: r ? !r.revokedAt : null,
          endsAt: s.accessEndsAt ?? s.contract.termEndAt,
        }
      })(),
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
  await revokeSeatAccess(seatId, `employer:${orgUser.userId}`)
  captureServerEvent(orgUser.userId, 'outplacement_seat_deactivated', { orgId: orgUser.orgId, seatId })
  return {}
}

async function ownSeat(orgUser: CurrentOutplacementOrgUser, seatId: string) {
  const seat = await prisma.outplacementSeat.findFirst({ where: { id: seatId, contract: { orgId: orgUser.orgId } }, select: { id: true, status: true, candidateId: true } })
  if (!seat) return null
  const own = await prisma.candidateProfile.findUnique({ where: { userId: orgUser.userId }, select: { id: true } })
  return own && seat.candidateId === own.id ? null : seat
}

// Manual override: turn coaching or the recruiter network on or off for one person.
export async function setSeatAccess(orgUser: CurrentOutplacementOrgUser, seatId: string, feature: Feature, on: boolean): Promise<{ error?: string }> {
  const seat = await ownSeat(orgUser, seatId)
  if (!seat) return { error: 'Seat not found.' }
  if (seat.status !== 'ACTIVATED') return { error: 'Turn things on once they have joined.' }
  const r = await setSeatFeature(seatId, feature, on, `employer:${orgUser.userId}`)
  if (r.error) return { error: r.error }
  captureServerEvent(orgUser.userId, 'outplacement_seat_access_set', { orgId: orgUser.orgId, seatId, feature, on })
  return {}
}

export async function setSeatSessions(orgUser: CurrentOutplacementOrgUser, seatId: string, sessions: number): Promise<{ error?: string }> {
  const seat = await ownSeat(orgUser, seatId)
  if (!seat) return { error: 'Seat not found.' }
  if (!(sessions >= 0 && sessions <= 100)) return { error: 'Sessions must be between 0 and 100.' }
  const g = await prisma.accessGrant.findFirst({ where: { source: 'outplacement_seat', sourceId: seatId, feature: 'coaching' } })
  if (!g) return { error: 'Turn coaching on first.' }
  await setGrantSessions(g.id, sessions, `employer:${orgUser.userId}`)
  captureServerEvent(orgUser.userId, 'outplacement_seat_sessions_set', { orgId: orgUser.orgId, seatId, sessions })
  return {}
}

// When this person's access ends (blank = the contract's end).
export async function setSeatAccessEnd(orgUser: CurrentOutplacementOrgUser, seatId: string, endsAt: Date | null): Promise<{ error?: string }> {
  const seat = await ownSeat(orgUser, seatId)
  if (!seat) return { error: 'Seat not found.' }
  await prisma.outplacementSeat.update({ where: { id: seatId }, data: { accessEndsAt: endsAt } })
  await prisma.accessGrant.updateMany({ where: { source: 'outplacement_seat', sourceId: seatId }, data: { endsAt } })
  if (!endsAt) await grantSeatAccess(seatId, `employer:${orgUser.userId}`).catch(() => null)
  captureServerEvent(orgUser.userId, 'outplacement_seat_access_end_set', { orgId: orgUser.orgId, seatId, hasEnd: !!endsAt })
  return {}
}

// ── Cohorts ─────────────────────────────────────────────────────────────────

export type CohortSummary = { cohort: string | null; invited: number; joined: number; placed: number; removed: number }

export function summarizeCohorts(seats: RosterSeat[]): CohortSummary[] {
  const m = new Map<string, CohortSummary>()
  for (const s of seats) {
    const k = s.cohort ?? ''
    const c = m.get(k) ?? { cohort: s.cohort, invited: 0, joined: 0, placed: 0, removed: 0 }
    if (s.status === 'INVITED') c.invited++
    else if (s.status === 'ACTIVATED') c.joined++
    else c.removed++
    if (s.placedAt) c.placed++
    m.set(k, c)
  }
  return [...m.values()].sort((a, b) => (a.cohort ?? '~').localeCompare(b.cohort ?? '~'))
}

// One change to everyone live in a cohort ('' = people with no cohort).
export async function updateCohort(
  orgUser: CurrentOutplacementOrgUser,
  cohort: string,
  change: { packageKey?: string | null; accessEndsAt?: Date | null; rename?: string | null },
): Promise<{ error?: string; count?: number }> {
  const own = await prisma.candidateProfile.findUnique({ where: { userId: orgUser.userId }, select: { id: true } })
  const seats = await prisma.outplacementSeat.findMany({
    where: { contract: { orgId: orgUser.orgId }, status: { not: 'DEACTIVATED' }, cohort: cohort || null, ...(own ? { NOT: { candidateId: own.id } } : {}) },
    select: { id: true, status: true },
  })
  if (!seats.length) return { error: 'No one is in that cohort.' }
  const data: Record<string, unknown> = {}
  if (change.packageKey !== undefined) data.packageKey = change.packageKey
  if (change.accessEndsAt !== undefined) data.accessEndsAt = change.accessEndsAt
  if (change.rename !== undefined) data.cohort = change.rename?.trim().slice(0, 80) || null
  await prisma.outplacementSeat.updateMany({ where: { id: { in: seats.map((s) => s.id) } }, data })
  if (change.packageKey !== undefined || change.accessEndsAt !== undefined) {
    for (const s of seats.filter((x) => x.status === 'ACTIVATED')) {
      if (change.accessEndsAt !== undefined) await prisma.accessGrant.updateMany({ where: { source: 'outplacement_seat', sourceId: s.id }, data: { endsAt: change.accessEndsAt } })
      await grantSeatAccess(s.id, `employer:${orgUser.userId}`, { prune: change.packageKey !== undefined }).catch(() => null)
    }
  }
  captureServerEvent(orgUser.userId, 'outplacement_cohort_updated', { orgId: orgUser.orgId, seats: seats.length, package: change.packageKey !== undefined, accessEnd: change.accessEndsAt !== undefined, rename: change.rename !== undefined })
  return { count: seats.length }
}
