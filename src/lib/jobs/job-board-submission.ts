import 'server-only'
import { prisma } from '@/lib/prisma'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export interface JobBoardSubmissionInput {
  title: string
  companyName: string
  location: string | null
  url: string
  description: string | null
  postingType: string | null
  contactName: string | null
  contactEmail: string | null
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
}

// Server-side enforcement of Prompt 61's "verified real" requirements —
// a submission missing any of these is rejected outright, not just
// discouraged in the UI.
export function validateJobBoardSubmission(input: JobBoardSubmissionInput): string | null {
  if (!input.title) return 'Job title is required.'
  if (!input.companyName) return 'Company name is required.'
  if (!input.url) return 'A real posting URL is required — no fabricated listings.'
  if (input.postingType !== 'direct' && input.postingType !== 'recruiter_search') {
    return 'Please specify whether this is a direct employer posting or a recruiter-led search.'
  }
  if (!input.contactName) {
    return 'A named recruiter or hiring manager contact is required — a generic team name or inbox is not enough.'
  }
  if (!input.contactEmail) return 'A contact email is required.'
  if (!input.salaryMin || !input.salaryMax) return 'A salary band (minimum and maximum) is required.'
  if (input.salaryMin > input.salaryMax) return 'Salary minimum cannot be higher than the maximum.'
  return null
}

export async function createPendingJobBoardPosting(
  input: JobBoardSubmissionInput,
  source: 'employer' | 'recruiter',
  submitterId: string,
  submitterEmail: string
) {
  return prisma.exclusiveJobPosting.create({
    data: {
      title: input.title,
      companyName: input.companyName,
      location: input.location,
      url: input.url,
      description: input.description,
      postingType: input.postingType,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      salaryMin: input.salaryMin,
      salaryMax: input.salaryMax,
      salaryCurrency: input.salaryCurrency || 'USD',
      status: 'pending',
      source,
      addedBy: submitterEmail,
      ...(source === 'employer'
        ? { submittedByEmployerId: submitterId }
        : { submittedByRecruiterId: submitterId }),
      expiresAt: new Date(Date.now() + THIRTY_DAYS_MS),
    },
  })
}

// The only path that pushes expiresAt forward — genuine re-confirmation,
// never a bare "bump" that resets the clock without it.
export async function reconfirmJobBoardPosting(id: string) {
  return prisma.exclusiveJobPosting.update({
    where: { id },
    data: { expiresAt: new Date(Date.now() + THIRTY_DAYS_MS), lastConfirmedAt: new Date() },
  })
}
