'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { validateJobBoardSubmission, reconfirmJobBoardPosting } from '@/lib/jobs/job-board-submission'
import { fetchJobPosting } from '@/lib/jobs/fetch-job-posting'
import { extractPostingFields, type ExtractedPostingFields } from '@/lib/jobs/extract-posting-fields'
import { countPendingJobMatches, loadAdminFitCandidates, type PendingJobMatchCount } from '@/lib/jobs/job-fit-bucket'

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
  // Also refreshes the "Job recommendations" section on every candidate
  // detail page — approving there is a common path into this action too.
  revalidatePath('/support/admin/candidates/[id]', 'page')
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

export type AutofillResult = { status: 'success'; fields: ExtractedPostingFields } | { status: 'error'; error: string }

// Powers the "Autofill from URL" step on the manual-add form — fetches the
// real posting page (same fetch/blocked-domain handling the candidate-facing
// Job Fit tool uses) and runs it through an LLM extraction pass so the admin
// isn't retyping title/company/location/salary by hand. Every field stays
// editable afterward; this only pre-fills a starting point.
export async function autofillJobPosting(url: string): Promise<AutofillResult> {
  await requireAdmin()

  const fetchResult = await fetchJobPosting(url)
  if (fetchResult.status !== 'success' || !fetchResult.text) {
    return { status: 'error', error: fetchResult.error ?? 'Could not fetch that URL.' }
  }

  const fields = await extractPostingFields(fetchResult.text)
  return { status: 'success', fields }
}

// Live fit preview for the manual-add form — the same matched/total/grade
// signal the ATS-sourced pending queue shows, computed on demand from
// whatever the admin has typed so far (title/location/salary), before the
// posting is even created. Manual postings save straight to 'approved' and
// skip the pending queue entirely, so this is the only point they'd ever get
// this signal.
export async function previewJobPostingFit(input: {
  title: string
  location: string | null
  salaryMin: number | null
  salaryMax: number | null
}): Promise<PendingJobMatchCount> {
  await requireAdmin()

  const candidates = await loadAdminFitCandidates()
  return countPendingJobMatches(
    {
      id: '',
      title: input.title,
      companyName: '',
      description: null,
      location: input.location,
      salaryMin: input.salaryMin,
      salaryMax: input.salaryMax,
      targetFunction: null,
      targetLevel: null,
      targetRemotePolicy: null,
      targetLocation: null,
    },
    candidates
  )
}

export async function approveAllPendingJobPostings() {
  await requireAdmin()

  const pending = await prisma.exclusiveJobPosting.findMany({
    where: { status: 'pending', archivedAt: null },
    select: { id: true, source: true, companyName: true },
  })
  if (pending.length === 0) return

  await prisma.exclusiveJobPosting.updateMany({
    where: { id: { in: pending.map((p) => p.id) } },
    data: { status: 'approved' },
  })
  for (const posting of pending) {
    captureServerEvent(posting.id, 'job_board_posting_approved', {
      postingId: posting.id,
      source: posting.source,
      companyName: posting.companyName,
      bulk: true,
    })
  }
  revalidatePath('/support/admin/exclusive-jobs')
}

export async function approveAllPendingForCompany(companyName: string) {
  await requireAdmin()

  const pending = await prisma.exclusiveJobPosting.findMany({
    where: { status: 'pending', archivedAt: null, companyName },
    select: { id: true, source: true },
  })
  if (pending.length === 0) return

  await prisma.exclusiveJobPosting.updateMany({
    where: { id: { in: pending.map((p) => p.id) } },
    data: { status: 'approved' },
  })
  for (const posting of pending) {
    captureServerEvent(posting.id, 'job_board_posting_approved', {
      postingId: posting.id,
      source: posting.source,
      companyName,
      bulk: true,
    })
  }
  revalidatePath('/support/admin/exclusive-jobs')
}

export async function rejectAllPendingJobPostings() {
  await requireAdmin()

  const pending = await prisma.exclusiveJobPosting.findMany({
    where: { status: 'pending', archivedAt: null },
    select: { id: true, source: true, companyName: true },
  })
  if (pending.length === 0) return

  await prisma.exclusiveJobPosting.updateMany({
    where: { id: { in: pending.map((p) => p.id) } },
    data: { status: 'rejected' },
  })
  for (const posting of pending) {
    captureServerEvent(posting.id, 'job_board_posting_rejected', {
      postingId: posting.id,
      source: posting.source,
      companyName: posting.companyName,
      bulk: true,
    })
  }
  revalidatePath('/support/admin/exclusive-jobs')
}

export async function rejectAllPendingForCompany(companyName: string) {
  await requireAdmin()

  const pending = await prisma.exclusiveJobPosting.findMany({
    where: { status: 'pending', archivedAt: null, companyName },
    select: { id: true, source: true },
  })
  if (pending.length === 0) return

  await prisma.exclusiveJobPosting.updateMany({
    where: { id: { in: pending.map((p) => p.id) } },
    data: { status: 'rejected' },
  })
  for (const posting of pending) {
    captureServerEvent(posting.id, 'job_board_posting_rejected', {
      postingId: posting.id,
      source: posting.source,
      companyName,
      bulk: true,
    })
  }
  revalidatePath('/support/admin/exclusive-jobs')
}
