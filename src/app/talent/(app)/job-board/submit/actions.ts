'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import {
  validateJobBoardSubmission,
  createPendingJobBoardPosting,
  type JobBoardSubmissionInput,
} from '@/lib/jobs/job-board-submission'
import { captureServerEvent } from '@/lib/posthog/server'
import type { JobBoardSubmitState } from '@/components/jobs/JobBoardSubmissionForm'

export async function submitEmployerJobBoardPosting(
  _prevState: JobBoardSubmitState,
  formData: FormData
): Promise<JobBoardSubmitState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to do this.' }

  const employer = await prisma.employerProfile.findUnique({ where: { userId: user.id } })
  if (!employer) return { error: 'You need to be logged in to do this.' }

  const input: JobBoardSubmissionInput = {
    title: (formData.get('title') as string | null)?.trim() || '',
    companyName: (formData.get('companyName') as string | null)?.trim() || '',
    location: (formData.get('location') as string | null)?.trim() || null,
    url: (formData.get('url') as string | null)?.trim() || '',
    description: (formData.get('description') as string | null)?.trim() || null,
    postingType: (formData.get('postingType') as string | null) || null,
    contactName: (formData.get('contactName') as string | null)?.trim() || null,
    contactEmail: (formData.get('contactEmail') as string | null)?.trim() || null,
    salaryMin: formData.get('salaryMin') ? Number(formData.get('salaryMin')) : null,
    salaryMax: formData.get('salaryMax') ? Number(formData.get('salaryMax')) : null,
    salaryCurrency: (formData.get('salaryCurrency') as string | null)?.trim() || null,
    audienceTier: (formData.get('audienceTier') as string | null) || 'A_LIST_ONLY',
    distribution: (formData.get('distribution') as string | null) || 'OPEN',
    disclosure: 'OPEN', // Hiring Managers never post confidentially — their own company.
    targetFunction: (formData.get('targetFunction') as string | null)?.trim() || null,
    targetLevel: (formData.get('targetLevel') as string | null)?.trim() || null,
    targetLocation: (formData.get('targetLocation') as string | null)?.trim() || null,
    targetRemotePolicy: (formData.get('targetRemotePolicy') as string | null) || null,
  }

  const values = {
    title: input.title,
    companyName: input.companyName,
    location: input.location ?? '',
    url: input.url,
    postingType: input.postingType ?? '',
    contactName: input.contactName ?? '',
    contactEmail: input.contactEmail ?? '',
    salaryMin: input.salaryMin?.toString() ?? '',
    salaryMax: input.salaryMax?.toString() ?? '',
    salaryCurrency: input.salaryCurrency ?? 'USD',
    description: input.description ?? '',
    audienceTier: input.audienceTier,
    distribution: input.distribution,
    targetFunction: input.targetFunction ?? '',
    targetLevel: input.targetLevel ?? '',
    targetLocation: input.targetLocation ?? '',
    targetRemotePolicy: input.targetRemotePolicy ?? '',
  }

  const error = validateJobBoardSubmission(input, 'employer')
  if (error) return { error, values }

  const posting = await createPendingJobBoardPosting(input, 'employer', employer.id, user.email ?? employer.companyName)

  captureServerEvent(employer.id, 'job_board_posting_submitted', {
    postingId: posting.id,
    source: 'employer',
    postingType: input.postingType,
  })

  return { success: true }
}
