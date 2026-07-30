'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { computeMatchScore } from '@/lib/matching/compute-match-score'
import { mapEmployerCompanySizeStringToBand } from '@/lib/scoring/level-rank'
import { captureServerEvent } from '@/lib/posthog/server'
import { sendEmployerInterestEmail } from '@/lib/email/send-employer-interest'
import { resolveEmployerForUserId } from '@/lib/talent/get-employer-for-user'

// Statuses that represent progress already made — never downgrade past
// these back to a lighter-touch status like SAVED.
const STATUS_PRECEDENCE = [
  'VIEWED',
  'SAVED',
  'INTEREST_EXPRESSED',
  'CANDIDATE_REVEALED',
  'IN_CONVERSATION',
  'HIRED',
] as const

function isFurtherAlong(current: string, next: string): boolean {
  const ci = STATUS_PRECEDENCE.indexOf(current as (typeof STATUS_PRECEDENCE)[number])
  const ni = STATUS_PRECEDENCE.indexOf(next as (typeof STATUS_PRECEDENCE)[number])
  return ci !== -1 && ni !== -1 && ci > ni
}

async function getEmployer() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return resolveEmployerForUserId(user.id)
}

export async function expressInterest(candidateId: string, roleId: string) {
  const employer = await getEmployer()
  if (!employer) return

  const [candidate, role] = await Promise.all([
    prisma.candidateProfile.findUnique({ where: { id: candidateId } }),
    prisma.roleProfile.findFirst({
      where: { id: roleId, employerId: employer.id },
      include: { employer: { select: { companySize: true } } },
    }),
  ])
  if (!candidate || !role) return

  const match = computeMatchScore(candidate, {
    ...role,
    employerCompanySizeBand: mapEmployerCompanySizeStringToBand(role.employer.companySize),
  })

  const existing = await prisma.candidateInteraction.findUnique({
    where: { employerId_candidateId: { employerId: employer.id, candidateId } },
  })
  if (existing && isFurtherAlong(existing.status, 'INTEREST_EXPRESSED')) {
    return
  }

  await prisma.candidateInteraction.upsert({
    where: { employerId_candidateId: { employerId: employer.id, candidateId } },
    update: { status: 'INTEREST_EXPRESSED', roleId, genericMatchScore: match.score },
    create: {
      employerId: employer.id,
      candidateId,
      roleId,
      status: 'INTEREST_EXPRESSED',
      genericMatchScore: match.score,
    },
  })

  if (candidate.email) {
    await sendEmployerInterestEmail(candidate.email, candidate.firstName, employer.companyName)
  }

  captureServerEvent(employer.id, 'candidate_interest_expressed', {
    employerId: employer.id,
    candidateId,
    roleId,
    matchScore: match.score,
  })

  revalidatePath(`/talent/roles/${roleId}/candidates`)
  revalidatePath('/dashboard')
}

export async function saveCandidate(candidateId: string, roleId: string) {
  const employer = await getEmployer()
  if (!employer) return

  const existing = await prisma.candidateInteraction.findUnique({
    where: { employerId_candidateId: { employerId: employer.id, candidateId } },
  })
  if (existing && isFurtherAlong(existing.status, 'SAVED')) {
    return
  }

  await prisma.candidateInteraction.upsert({
    where: { employerId_candidateId: { employerId: employer.id, candidateId } },
    update: { status: 'SAVED', roleId },
    create: { employerId: employer.id, candidateId, roleId, status: 'SAVED' },
  })

  captureServerEvent(employer.id, 'candidate_saved', { employerId: employer.id, candidateId, roleId })

  revalidatePath(`/talent/roles/${roleId}/candidates`)
}
