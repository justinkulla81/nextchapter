'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'

// Candidate-initiated "Express interest" on a matched role — shared by both
// MatchedRoleList call sites (Board Advisory Work, Full-time Work). Upserts
// on the existing @@unique([employerId, candidateId]) CandidateInteraction
// row rather than creating a second one — that constraint means one row per
// employer-candidate pair regardless of role, matching how employer-side
// interactions already work. status is left untouched on update since it's
// employer-owned semantics; initiatedByCandidate is the signal Talent's
// Candidate Inbox uses to show "this candidate reached out first."
export async function expressInterestInRole(roleId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const role = await prisma.roleProfile.findUnique({ where: { id: roleId }, select: { employerId: true } })
  if (!role) return

  const profile = await getOrCreateCandidateProfile(user.id)

  await prisma.candidateInteraction.upsert({
    where: { employerId_candidateId: { employerId: role.employerId, candidateId: profile.id } },
    create: {
      employerId: role.employerId,
      candidateId: profile.id,
      roleId,
      initiatedByCandidate: true,
    },
    update: {
      roleId,
      initiatedByCandidate: true,
    },
  })

  captureServerEvent(profile.id, 'candidate_expressed_interest_in_role', { roleId, employerId: role.employerId })
}
