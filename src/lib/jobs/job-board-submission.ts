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
  // NC Job Board 2.0 visibility model — see the schema comment on
  // ExclusiveJobPosting for what each of these means.
  audienceTier: string
  distribution: string
  disclosure: string
  targetFunction: string | null
  targetLevel: string | null
  targetLocation: string | null
  targetRemotePolicy: string | null
}

// Server-side enforcement of Prompt 61's "verified real" requirements —
// a submission missing any of these is rejected outright, not just
// discouraged in the UI. `source` also gates the two recruiter-only
// visibility capabilities (EXCLUDED distribution, CONFIDENTIAL disclosure)
// server-side, since the form's own capability flags are client-editable.
export function validateJobBoardSubmission(
  input: JobBoardSubmissionInput,
  source: 'admin' | 'employer' | 'recruiter'
): string | null {
  if (!input.title) return 'Job title is required.'
  if (!input.companyName) return 'Company name is required.'
  if (!input.url) return 'A real posting URL is required — no fabricated listings.'
  if (input.postingType !== 'direct' && input.postingType !== 'recruiter_search') {
    return 'Please specify whether this is a direct employer posting or a recruiter-led search.'
  }
  // Employer/recruiter self-submissions have no domain verification elsewhere
  // in the app, so a named contact is the trust gate — required there. An
  // admin adding a posting by hand has already vetted it personally, so this
  // is optional for that source only.
  if (source !== 'admin') {
    if (!input.contactName) {
      return 'A named recruiter or hiring manager contact is required — a generic team name or inbox is not enough.'
    }
    if (!input.contactEmail) return 'A contact email is required.'
  }
  if (!input.salaryMin || !input.salaryMax) return 'A salary band (minimum and maximum) is required.'
  if (input.salaryMin > input.salaryMax) return 'Salary minimum cannot be higher than the maximum.'

  if (input.audienceTier !== 'ALL_CANDIDATES' && input.audienceTier !== 'A_LIST_ONLY') {
    return 'Please choose who can see this listing.'
  }
  const validDistributions =
    source === 'recruiter' ? ['OPEN', 'TARGETED', 'EXCLUDED'] : ['OPEN', 'TARGETED']
  if (!validDistributions.includes(input.distribution)) {
    return 'Please choose a valid distribution setting.'
  }
  if (input.disclosure === 'CONFIDENTIAL' && source !== 'recruiter') {
    return 'Only a recruiter-led search can be listed confidentially.'
  }
  if (input.disclosure !== 'OPEN' && input.disclosure !== 'CONFIDENTIAL') {
    return 'Please choose a valid company-name setting.'
  }
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
      audienceTier: input.audienceTier,
      distribution: input.distribution,
      disclosure: input.disclosure,
      targetFunction: input.targetFunction,
      targetLevel: input.targetLevel,
      targetLocation: input.targetLocation,
      targetRemotePolicy: input.targetRemotePolicy,
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
