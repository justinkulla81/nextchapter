'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import {
  createSubmission,
  advanceSubmissionStage,
  passSubmission,
  recordPlacement,
} from '@/lib/recruiter/submissions'
import type { RecruiterFeeArrangementType, RecruiterSubmissionStage } from '@prisma/client'

export type SubmissionActionState = { error?: string } | undefined

async function requireRecruiter() {
  const supabase = await createClient('recruiter')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.recruiter.findUnique({ where: { userId: user.id } })
}

export async function createCandidateSubmission(
  candidateId: string,
  _prevState: SubmissionActionState,
  formData: FormData
): Promise<SubmissionActionState> {
  const recruiter = await requireRecruiter()
  if (!recruiter) return { error: 'You need to be logged in to do this.' }

  const roleTitle = (formData.get('roleTitle') as string | null) ?? ''
  const companyName = (formData.get('companyName') as string | null) ?? ''

  const result = await createSubmission(recruiter.id, candidateId, roleTitle, companyName)
  if (result.error) return { error: result.error }

  captureServerEvent(recruiter.id, 'recruiter_candidate_submission_created', {
    recruiterId: recruiter.id,
    candidateId,
    submissionId: result.submissionId,
  })
  revalidatePath(`/recruiters/search/${candidateId}`)
  return undefined
}

export async function advanceCandidateSubmissionStage(
  submissionId: string,
  candidateId: string,
  toStage: Exclude<RecruiterSubmissionStage, 'PASSED'>
): Promise<void> {
  const recruiter = await requireRecruiter()
  if (!recruiter) return

  const result = await advanceSubmissionStage(submissionId, recruiter.id, toStage)
  if (!result.error) {
    captureServerEvent(recruiter.id, 'recruiter_submission_stage_advanced', {
      recruiterId: recruiter.id,
      submissionId,
      toStage,
    })
  }
  revalidatePath(`/recruiters/search/${candidateId}`)
}

export async function passCandidateSubmission(
  submissionId: string,
  candidateId: string,
  _prevState: SubmissionActionState,
  formData: FormData
): Promise<SubmissionActionState> {
  const recruiter = await requireRecruiter()
  if (!recruiter) return { error: 'You need to be logged in to do this.' }

  const reason = (formData.get('reason') as string | null) ?? ''
  const result = await passSubmission(submissionId, recruiter.id, reason)
  if (result.error) return { error: result.error }

  captureServerEvent(recruiter.id, 'recruiter_submission_passed', { recruiterId: recruiter.id, submissionId })
  revalidatePath(`/recruiters/search/${candidateId}`)
  return undefined
}

export async function recordCandidatePlacement(
  submissionId: string,
  candidateId: string,
  _prevState: SubmissionActionState,
  formData: FormData
): Promise<SubmissionActionState> {
  const recruiter = await requireRecruiter()
  if (!recruiter) return { error: 'You need to be logged in to do this.' }

  const feeTypeRaw = (formData.get('feeType') as string | null) || null
  const feeType: RecruiterFeeArrangementType | null =
    feeTypeRaw === 'PERCENTAGE_OF_COMP' || feeTypeRaw === 'FLAT_FEE' || feeTypeRaw === 'RETAINER' ? feeTypeRaw : null
  const feePercentageRaw = (formData.get('feePercentage') as string | null)?.trim()
  const feeFlatAmountRaw = (formData.get('feeFlatAmountUsd') as string | null)?.trim()
  const startDateRaw = (formData.get('startDate') as string | null)?.trim()
  const feeNotes = (formData.get('feeNotes') as string | null)?.trim() || null

  const result = await recordPlacement(submissionId, recruiter.id, {
    feeType,
    feePercentage: feePercentageRaw ? Number(feePercentageRaw) : null,
    feeFlatAmountUsd: feeFlatAmountRaw ? Number(feeFlatAmountRaw) : null,
    feeNotes,
    startDate: startDateRaw ? new Date(startDateRaw) : null,
  })
  if (result.error) return { error: result.error }

  captureServerEvent(recruiter.id, 'recruiter_placement_recorded', {
    recruiterId: recruiter.id,
    submissionId,
    placementId: result.placementId,
  })
  revalidatePath(`/recruiters/search/${candidateId}`)
  return undefined
}
