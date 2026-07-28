'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { validateJobBoardSubmission, reconfirmJobBoardPosting } from '@/lib/jobs/job-board-submission'

export type FormState = { error?: string } | undefined

export async function createExclusiveJobPosting(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin()

  const input = {
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
    disclosure: 'OPEN', // NC-sourced listings always name the company.
    targetFunction: (formData.get('targetFunction') as string | null)?.trim() || null,
    targetLevel: (formData.get('targetLevel') as string | null)?.trim() || null,
    targetLocation: (formData.get('targetLocation') as string | null)?.trim() || null,
    targetRemotePolicy: (formData.get('targetRemotePolicy') as string | null) || null,
  }

  const error = validateJobBoardSubmission(input, 'admin')
  if (error) return { error }

  const posting = await prisma.exclusiveJobPosting.create({
    data: {
      ...input,
      salaryCurrency: input.salaryCurrency || 'USD',
      status: 'approved', // admin-added postings are trusted immediately, same as before this feature existed
      source: 'admin',
      addedBy: admin?.email ?? 'unknown',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })

  captureServerEvent(posting.id, 'exclusive_job_posted', { companyName: input.companyName })

  revalidatePath('/support/admin/exclusive-jobs')
}

export async function archiveExclusiveJobPosting(postingId: string) {
  await requireAdmin()

  await prisma.exclusiveJobPosting.update({ where: { id: postingId }, data: { archivedAt: new Date() } })
  revalidatePath('/support/admin/exclusive-jobs')
}

export async function approveJobPosting(postingId: string) {
  await requireAdmin()

  const posting = await prisma.exclusiveJobPosting.update({
    where: { id: postingId },
    data: { status: 'approved' },
  })
  captureServerEvent(postingId, 'job_board_posting_approved', {
    postingId,
    source: posting.source,
    companyName: posting.companyName,
  })
  revalidatePath('/support/admin/exclusive-jobs')
}

export async function rejectJobPosting(postingId: string, formData: FormData) {
  await requireAdmin()

  const reason = (formData.get('rejectionReason') as string | null)?.trim() || null
  const posting = await prisma.exclusiveJobPosting.update({
    where: { id: postingId },
    data: { status: 'rejected', rejectionReason: reason },
  })
  captureServerEvent(postingId, 'job_board_posting_rejected', {
    postingId,
    source: posting.source,
    companyName: posting.companyName,
    reason,
  })
  revalidatePath('/support/admin/exclusive-jobs')
}

export async function reconfirmJobPostingAdmin(postingId: string) {
  await requireAdmin()

  await reconfirmJobBoardPosting(postingId)
  revalidatePath('/support/admin/exclusive-jobs')
}
