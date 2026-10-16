import 'server-only'
import { applyJourneyChange } from '@/lib/journey/apply'
import { effectiveJourney, effectiveStage } from '@/lib/journey/journey'
import { shouldApplySponsoredStart, sponsoredStart } from '@/lib/journey/sponsored'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { createPreConfirmedInviteUser } from '@/lib/invite/invite-and-preconfirm'
import { findExistingRegisteredAccount } from '@/lib/onboarding/duplicate-check'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { sendOutplacementSeatInviteEmail, sendOutplacementSeatLinkedEmail } from '@/lib/email/send-outplacement-emails'
import { orgProgram } from './program-server'
import { captureServerEvent } from '@/lib/posthog/server'
import { parseEnrollmentCsv } from '@/lib/employer/parse-enrollment-csv'
import type { OutplacementEnrollmentMethod } from '@prisma/client'
import type { CurrentOutplacementOrgUser } from '@/lib/employer/outplacement-auth'
import { grantSeatAccess } from '@/lib/access/grants'
import { applyOutplacementCensus } from '@/lib/census/outplacement'
import { callbackOriginForAppPath } from '@/lib/portal-hosts'

// Partners Master Build Script §A7 — "single, bulk CSV, and [documented-
// but-not-built] API enrollment." Real third-party API auth/integration is
// out of scope this phase (flagged, not fabricated — see this phase's
// report); OutplacementEnrollmentMethod has no API value for exactly that
// reason.
//
// "Whichever mechanism links a real person to a seat, that linking step is
// necessarily identity-aware... the invariant is about what's exposed BACK
// to the employer afterward (aggregates only), not about enrollment itself
// being blind." Every function below is identity-aware by design — it's
// the reporting/roster split (see outplacement-reporting.ts vs.
// outplacement-roster.ts) that enforces the actual privacy boundary.


export interface EnrollableContract {
  id: string
  cohortLabel: string | null
  tier: string
  seatCount: number
  usedSeats: number
}

// Contracts this org can still enroll into — ACTIVE status and at least
// one seat not already spoken for. usedSeats counts every non-deactivated
// seat (INVITED + ACTIVATED both hold a seat against the purchased count).
export async function getEnrollableContracts(orgId: string): Promise<EnrollableContract[]> {
  const contracts = await prisma.outplacementContract.findMany({
    where: { orgId, status: 'ACTIVE' },
    select: {
      id: true,
      cohortLabel: true,
      tier: true,
      seatCount: true,
      _count: { select: { seats: { where: { status: { not: 'DEACTIVATED' } } } } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return contracts.map((c) => ({
    id: c.id,
    cohortLabel: c.cohortLabel,
    tier: c.tier,
    seatCount: c.seatCount,
    usedSeats: c._count.seats,
  }))
}

export interface EnrollOneResult {
  email: string
  outcome: 'invited' | 'linked' | 'error'
  error?: string
}

// Shared by both the single-enrollment form and each row of a bulk CSV
// upload. Two distinct outcomes depending on whether the email already has
// a registered NextChapter account:
//   - No existing account: create the seat in INVITED status and send a
//     pre-confirmed magic-link invite (same primitive as coach client
//     invites — see createPreConfirmedInviteUser).
//   - Existing registered account: link immediately (ACTIVATED), no invite
//     needed — just a notice email. This is the "linking an existing one"
//     path the spec calls out as a valid enrollment mechanism distinct from
//     inviting a brand-new account.
export type SeatExtra = { externalId?: string | null; cohort?: string | null; accessEndsAt?: Date | null }

export async function enrollOneSeat(
  contractId: string,
  orgName: string,
  email: string,
  name: string | null,
  method: OutplacementEnrollmentMethod,
  packageKey: string | null = null,
  extra: SeatExtra = {}
): Promise<EnrollOneResult> {
  const existing = await findExistingRegisteredAccount(email, '')
  if (existing) {
    const linked = await prisma.outplacementSeat.create({
      data: {
        contractId,
        invitedEmail: email,
        invitedName: name,
        enrollmentMethod: method,
        status: 'ACTIVATED',
        candidateId: existing.id,
        activatedAt: new Date(),
        packageKey,
        ...extra,
      },
    })
    await grantSeatAccess(linked.id).catch(() => null)
    await startOutplacementJourney(existing.id, contractId)
    await sendOutplacementSeatLinkedEmail(email, orgName)
    return { email, outcome: 'linked' }
  }

  const seat = await prisma.outplacementSeat.create({
    data: { contractId, invitedEmail: email, invitedName: name, enrollmentMethod: method, packageKey, ...extra },
  })

  const { actionLink, error } = await createPreConfirmedInviteUser(
    email,
    `${callbackOriginForAppPath('/dashboard')}/auth/callback?next=outplacement-seat&inviteToken=${seat.inviteToken}`,
    { isFirstSend: true }
  )
  if (error || !actionLink) {
    await prisma.outplacementSeat.delete({ where: { id: seat.id } })
    return { email, outcome: 'error', error: error ?? 'Something went wrong sending the invite.' }
  }

  const contract = await prisma.outplacementContract.findUnique({ where: { id: contractId }, select: { orgId: true } })
  const program = contract ? await orgProgram(contract.orgId) : null
  await sendOutplacementSeatInviteEmail(email, orgName, actionLink, program ? { welcome: program.settings.welcome, services: program.forPackage(packageKey).map((f) => f.label) } : undefined)
  return { email, outcome: 'invited' }
}

export interface EnrollSingleResult {
  error?: string
  result?: EnrollOneResult
}

export async function enrollSingleSeat(
  orgUser: CurrentOutplacementOrgUser,
  contractId: string,
  email: string,
  name: string | null,
  packageKey: string | null = null
): Promise<EnrollSingleResult> {
  const cleanEmail = email.trim().toLowerCase()
  if (!cleanEmail || !cleanEmail.includes('@')) return { error: 'Enter a valid email address.' }

  const contract = await prisma.outplacementContract.findFirst({
    where: { id: contractId, orgId: orgUser.orgId, status: 'ACTIVE' },
    include: {
      org: { select: { name: true } },
      _count: { select: { seats: { where: { status: { not: 'DEACTIVATED' } } } } },
    },
  })
  if (!contract) return { error: 'That contract is not available for enrollment.' }
  if (contract._count.seats >= contract.seatCount) {
    return { error: `This contract's ${contract.seatCount} seats are all in use. Contact NextChapter to add seats.` }
  }

  const alreadyOnThisContract = await prisma.outplacementSeat.findFirst({
    where: { contractId, invitedEmail: cleanEmail, status: { not: 'DEACTIVATED' } },
  })
  if (alreadyOnThisContract) return { error: 'This person already has a seat on this contract.' }

  const result = await enrollOneSeat(contractId, contract.org.name, cleanEmail, name?.trim() || null, 'SINGLE', packageKey)
  if (result.outcome === 'error') return { error: result.error }

  captureServerEvent(orgUser.userId, 'outplacement_seat_enrolled', {
    orgId: orgUser.orgId,
    contractId,
    method: 'SINGLE',
    outcome: result.outcome,
  })

  return { result }
}

export interface EnrollBulkResult {
  error?: string
  invited: number
  linked: number
  updated?: number
  removed?: number
  failed: number
  rowErrors: string[]
}

export async function enrollBulkCsv(
  orgUser: CurrentOutplacementOrgUser,
  contractId: string,
  csvText: string,
  packageKey: string | null = null
): Promise<EnrollBulkResult> {
  const { rows, errors: parseErrors } = parseEnrollmentCsv(csvText)
  if (rows.length === 0) {
    return { error: parseErrors[0] ?? 'No valid rows found in this file.', invited: 0, linked: 0, failed: 0, rowErrors: parseErrors }
  }
  // Census semantics: people already on the roster are updated, not refused.
  const r = await applyOutplacementCensus({
    orgId: orgUser.orgId,
    actor: orgUser.userId,
    method: 'BULK_CSV',
    contractId,
    defaultPackage: packageKey,
    people: rows.map((row) => ({ row: row.line, email: row.email, name: row.name, externalId: row.externalId, cohort: row.cohort, package: row.package, accessEnds: row.accessEnds, remove: row.remove })),
  })
  if (r.fileError) return { error: r.fileError, invited: 0, linked: 0, failed: 0, rowErrors: parseErrors }
  return {
    invited: r.invited,
    linked: r.linked,
    updated: r.updated,
    removed: r.removed,
    failed: r.failed,
    rowErrors: [...parseErrors, ...r.errors.map((e) => `Row ${e.row}: ${e.email ? `${e.email}: ` : ''}${e.message}`)],
  }
}

// Called from CallbackHandler once an admin-generated magic link (fresh
// candidate) has established a session — same shape as
// finishAcceptingCoachInvite. Non-redirecting; CallbackHandler decides
// what's next (SecureAccountForm, since this is the candidate's very first
// authentication).
export async function finishAcceptingOutplacementSeat(inviteToken: string): Promise<{ error?: string }> {
  const supabase = await createClient('employer')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !user.email) return { error: 'You need to be logged in to accept this invite.' }

  const seat = await prisma.outplacementSeat.findUnique({ where: { inviteToken } })
  if (!seat) return { error: 'This invite link is not valid.' }
  if (seat.status !== 'INVITED') return { error: 'This invite has already been accepted.' }
  if (user.email.toLowerCase() !== seat.invitedEmail.toLowerCase()) {
    return { error: `This invite was sent to ${seat.invitedEmail}. Log in with that email to accept it.` }
  }

  // Defensive re-check for the race where someone else registered this
  // email between the invite being sent and it being accepted.
  const nowRegistered = await findExistingRegisteredAccount(user.email, '')
  if (nowRegistered) {
    await prisma.outplacementSeat.update({
      where: { id: seat.id },
      data: { status: 'ACTIVATED', candidateId: nowRegistered.id, activatedAt: new Date() },
    })
    await grantSeatAccess(seat.id).catch(() => null)
    await startOutplacementJourney(nowRegistered.id, seat.contractId)
    return {}
  }

  const profile = await getOrCreateCandidateProfile(user.id)
  await prisma.outplacementSeat.update({
    where: { id: seat.id },
    data: { status: 'ACTIVATED', candidateId: profile.id, activatedAt: new Date() },
  })
  await grantSeatAccess(seat.id).catch(() => null)

  captureServerEvent(profile.id, 'outplacement_seat_activated', { contractId: seat.contractId, seatId: seat.id })
  await startOutplacementJourney(profile.id, seat.contractId)

  return {}
}

// A seat starts the journey its contract names (src/lib/journey/sponsored.ts).
// Outplacement: the job ended, so Laid off, applying. Career growth: Managing
// my career, Promotion or Changing careers, and never over someone who is
// already in a search. The employer is not told about later journey changes.
async function startOutplacementJourney(candidateId: string, contractId: string): Promise<void> {
  const [contract, profile] = await Promise.all([
    prisma.outplacementContract.findUnique({ where: { id: contractId }, select: { journey: true } }),
    prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { journey: true, journeyStage: true, currentJobStatus: true } }),
  ])
  const start = sponsoredStart(contract?.journey)
  if (profile && !shouldApplySponsoredStart(start, effectiveJourney(profile), effectiveStage(profile))) return
  await applyJourneyChange(candidateId, {
    journey: start.journey,
    stage: start.stage,
    source: 'ONBOARDING',
    note: start.onlyIfNotSearching ? 'Career growth seat' : 'Outplacement seat',
  })
}
