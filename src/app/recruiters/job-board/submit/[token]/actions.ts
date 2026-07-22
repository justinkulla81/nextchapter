'use server'

import { prisma } from '@/lib/prisma'
import {
  validateJobBoardSubmission,
  createPendingJobBoardPosting,
  type JobBoardSubmissionInput,
} from '@/lib/jobs/job-board-submission'
import { captureServerEvent } from '@/lib/posthog/server'
import type { JobBoardSubmitState } from '@/components/jobs/JobBoardSubmissionForm'

export async function submitRecruiterJobBoardPosting(
  token: string,
  _prevState: JobBoardSubmitState,
  formData: FormData
): Promise<JobBoardSubmitState> {
  const recruiter = await prisma.recruiter.findUnique({ where: { accessToken: token } })
  if (!recruiter) return { error: 'This link is not valid.' }

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
  }

  const error = validateJobBoardSubmission(input)
  if (error) return { error, values }

  const posting = await createPendingJobBoardPosting(input, 'recruiter', recruiter.id, recruiter.workEmail)

  captureServerEvent(recruiter.id, 'job_board_posting_submitted', {
    postingId: posting.id,
    source: 'recruiter',
    postingType: input.postingType,
  })

  return { success: true }
}
