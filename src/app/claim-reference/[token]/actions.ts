'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { syncReferenceDelta } from '@/lib/scoring/reference-delta'
import { generateReferenceQuotes } from '@/lib/references/testimony-processing'
import { applyReferenceCompletedRewrite } from '@/lib/scoring/rewrite-actions'
import { captureServerEvent } from '@/lib/posthog/server'

// The one moment an EmployerReferenceSubmission becomes a real Reference
// row — before this, nothing here is reachable by Dossier, Coaching Notes,
// or anywhere else that queries Reference (see Prompt 65 section 1 and the
// schema comment on EmployerReferenceSubmission). candidateId comes from
// the authenticated caller (claim-reference/[token]/page.tsx passes
// profile.id), never from the submission itself, so this can only ever be
// attached to the person who's actually signed in and chose to accept it.
export async function acceptEmployerReference(submissionId: string, candidateId: string): Promise<void> {
  const submission = await prisma.employerReferenceSubmission.findUnique({ where: { id: submissionId } })
  if (!submission || submission.status !== 'pending') {
    redirect('/dashboard')
  }

  const reference = await prisma.reference.create({
    data: {
      candidateId,
      refereeEmail: submission.submitterEmail,
      refereeName: submission.submitterName,
      refereeTitle: submission.submitterTitle,
      refereeCompany: submission.submitterCompany,
      relationshipType: submission.relationshipType,
      yearsWorkedTogether: submission.yearsWorkedTogether,
      status: 'COMPLETED',
      completedAt: new Date(),
      overallRating: submission.overallRating,
      wouldHireAgain: submission.wouldHireAgain,
      strengthSummary: submission.strengthSummary,
      growthAreaSummary: submission.growthAreaSummary,
      contextNotes: submission.contextNotes,
      barsVelocity: submission.barsVelocity,
      barsArchitecture: submission.barsArchitecture,
      barsStructure: submission.barsStructure,
      barsCommunication: submission.barsCommunication,
      barsEnvironment: submission.barsEnvironment,
      barsLeadership: submission.barsLeadership,
      barsOversight: submission.barsOversight,
      barsCommitment: submission.barsCommitment,
      barsConscientiousness: submission.barsConscientiousness,
      traitAdaptabilityRating: submission.traitAdaptabilityRating,
      traitAdaptabilityExample: submission.traitAdaptabilityExample,
      traitFollowThroughRating: submission.traitFollowThroughRating,
      traitFollowThroughExample: submission.traitFollowThroughExample,
      traitPresenceRating: submission.traitPresenceRating,
      traitPresenceExample: submission.traitPresenceExample,
      traitCollaborationRating: submission.traitCollaborationRating,
      traitCollaborationExample: submission.traitCollaborationExample,
      traitComposureRating: submission.traitComposureRating,
      traitComposureExample: submission.traitComposureExample,
      superpowerText: submission.superpowerText,
      underPressureStory: submission.underPressureStory,
      definingStory: submission.definingStory,
      wouldWorkWithAgainReason: submission.wouldWorkWithAgainReason,
      quotableWithAttribution: submission.quotableWithAttribution,
    },
  })

  await prisma.employerReferenceSubmission.update({
    where: { id: submissionId },
    data: {
      status: 'claimed',
      claimedByCandidateId: candidateId,
      claimedAt: new Date(),
      createdReferenceId: reference.id,
    },
  })

  // Same downstream effects any other completed reference gets — must
  // never block the candidate's acceptance from succeeding.
  try {
    await syncReferenceDelta(candidateId)
  } catch (error) {
    console.error('Failed to sync reference delta after employer reference claim:', error)
  }
  try {
    await generateReferenceQuotes(reference)
  } catch (error) {
    console.error('Failed to generate reference quotes after employer reference claim:', error)
  }
  try {
    await applyReferenceCompletedRewrite(candidateId, reference)
  } catch (error) {
    console.error('Failed to apply reference-completed baseline rewrite after employer reference claim:', error)
  }

  captureServerEvent(candidateId, 'employer_reference_accepted', { submissionId, referenceId: reference.id })

  redirect('/dashboard/references')
}

export async function declineEmployerReference(submissionId: string, candidateId: string): Promise<void> {
  const submission = await prisma.employerReferenceSubmission.findUnique({ where: { id: submissionId } })
  if (!submission || submission.status !== 'pending') {
    redirect('/dashboard')
  }

  await prisma.employerReferenceSubmission.update({
    where: { id: submissionId },
    data: { status: 'declined', declinedAt: new Date() },
  })

  captureServerEvent(candidateId, 'employer_reference_declined', { submissionId })

  redirect('/dashboard')
}
