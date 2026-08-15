import 'server-only'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { createPreConfirmedInviteUser } from '@/lib/invite/invite-and-preconfirm'
import { findExistingRegisteredAccount } from '@/lib/onboarding/duplicate-check'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { sendOutplacementSeatInviteEmail, sendOutplacementSeatLinkedEmail } from '@/lib/email/send-outplacement-emails'
import { captureServerEvent } from '@/lib/posthog/server'
import { parseEnrollmentCsv } from '@/lib/employer/parse-enrollment-csv'
import type { OutplacementEnrollmentMethod } from '@prisma/client'
import type { CurrentOutplacementOrgUser } from '@/lib/employer/outplacement-auth'

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

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

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
async function enrollOneSeat(
  contractId: string,
  orgName: string,
  email: string,
  name: string | null,
  method: OutplacementEnrollmentMethod
): Promise<EnrollOneResult> {
  const existing = await findExistingRegisteredAccount(email, '')
  if (existing) {
    await prisma.outplacementSeat.create({
      data: {
        contractId,
        invitedEmail: email,
        invitedName: name,
        enrollmentMethod: method,
        status: 'ACTIVATED',
        candidateId: existing.id,
        activatedAt: new Date(),
      },
    })
    await sendOutplacementSeatLinkedEmail(email, orgName)
    return { email, outcome: 'linked' }
  }

  const seat = await prisma.outplacementSeat.create({
    data: { contractId, invitedEmail: email, invitedName: name, enrollmentMethod: method },
  })

  const { actionLink, error } = await createPreConfirmedInviteUser(
    email,
    `${appUrl()}/auth/callback?next=outplacement-seat&inviteToken=${seat.inviteToken}`,
    { isFirstSend: true }
  )
  if (error || !actionLink) {
    await prisma.outplacementSeat.delete({ where: { id: seat.id } })
    return { email, outcome: 'error', error: error ?? 'Something went wrong sending the invite.' }
  }

  await sendOutplacementSeatInviteEmail(email, orgName, actionLink)
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
  name: string | null
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

  const result = await enrollOneSeat(contractId, contract.org.name, cleanEmail, name?.trim() || null, 'SINGLE')
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
  failed: number
  rowErrors: string[]
}

export async function enrollBulkCsv(
  orgUser: CurrentOutplacementOrgUser,
  contractId: string,
  csvText: string
): Promise<EnrollBulkResult> {
  const contract = await prisma.outplacementContract.findFirst({
    where: { id: contractId, orgId: orgUser.orgId, status: 'ACTIVE' },
    include: {
      org: { select: { name: true } },
      _count: { select: { seats: { where: { status: { not: 'DEACTIVATED' } } } } },
    },
  })
  if (!contract) return { error: 'That contract is not available for enrollment.', invited: 0, linked: 0, failed: 0, rowErrors: [] }

  const { rows, errors: parseErrors } = parseEnrollmentCsv(csvText)
  if (rows.length === 0) {
    return { error: parseErrors[0] ?? 'No valid rows found in this file.', invited: 0, linked: 0, failed: 0, rowErrors: parseErrors }
  }

  const remainingCapacity = contract.seatCount - contract._count.seats
  if (rows.length > remainingCapacity) {
    return {
      error: `This file has ${rows.length} people but this contract only has ${remainingCapacity} seat${remainingCapacity === 1 ? '' : 's'} left.`,
      invited: 0,
      linked: 0,
      failed: 0,
      rowErrors: parseErrors,
    }
  }

  let invited = 0
  let linked = 0
  let failed = 0
  const rowErrors = [...parseErrors]

  for (const row of rows) {
    const dup = await prisma.outplacementSeat.findFirst({
      where: { contractId, invitedEmail: row.email, status: { not: 'DEACTIVATED' } },
    })
    if (dup) {
      failed++
      rowErrors.push(`Row ${row.line}: ${row.email} already has a seat on this contract — skipped.`)
      continue
    }
    const result = await enrollOneSeat(contractId, contract.org.name, row.email, row.name, 'BULK_CSV')
    if (result.outcome === 'error') {
      failed++
      rowErrors.push(`Row ${row.line}: ${result.error}`)
    } else if (result.outcome === 'invited') {
      invited++
    } else {
      linked++
    }
  }

  captureServerEvent(orgUser.userId, 'outplacement_seats_bulk_enrolled', {
    orgId: orgUser.orgId,
    contractId,
    rowCount: rows.length,
    invited,
    linked,
    failed,
  })

  return { invited, linked, failed, rowErrors }
}

// Called from CallbackHandler once an admin-generated magic link (fresh
// candidate) has established a session — same shape as
// finishAcceptingCoachInvite. Non-redirecting; CallbackHandler decides
// what's next (SecureAccountForm, since this is the candidate's very first
// authentication).
export async function finishAcceptingOutplacementSeat(inviteToken: string): Promise<{ error?: string }> {
  const supabase = await createClient()
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
    return {}
  }

  const profile = await getOrCreateCandidateProfile(user.id)
  await prisma.outplacementSeat.update({
    where: { id: seat.id },
    data: { status: 'ACTIVATED', candidateId: profile.id, activatedAt: new Date() },
  })

  captureServerEvent(profile.id, 'outplacement_seat_activated', { contractId: seat.contractId, seatId: seat.id })

  return {}
}
