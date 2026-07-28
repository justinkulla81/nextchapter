'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'

export type FormState = { error?: string } | undefined

export async function createLayoffCohort(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin()

  const companyName = (formData.get('companyName') as string | null)?.trim()
  const layoffDateRaw = formData.get('layoffDate') as string | null
  const estimatedSizeRaw = (formData.get('estimatedSize') as string | null)?.trim()
  const newsUrl = (formData.get('newsUrl') as string | null)?.trim()

  if (!companyName) return { error: 'Company name is required.' }
  if (!layoffDateRaw) return { error: 'Layoff date is required.' }

  const layoffDate = new Date(layoffDateRaw)
  if (Number.isNaN(layoffDate.getTime())) return { error: 'Enter a valid layoff date.' }

  const estimatedSize = estimatedSizeRaw ? parseInt(estimatedSizeRaw, 10) : null
  if (estimatedSizeRaw && (estimatedSize === null || Number.isNaN(estimatedSize))) {
    return { error: 'Estimated size must be a number.' }
  }

  const cohort = await prisma.layoffCohort.create({
    data: { companyName, layoffDate, estimatedSize, newsUrl: newsUrl || null },
  })

  captureServerEvent(cohort.id, 'layoff_cohort_created', { companyName })

  revalidatePath('/support/admin/layoff-cohorts')
}

export async function deactivateLayoffCohort(cohortId: string) {
  await requireAdmin()

  await prisma.layoffCohort.update({ where: { id: cohortId }, data: { isActive: false } })
  revalidatePath('/support/admin/layoff-cohorts')
}

export async function assignCandidateToCohort(candidateId: string, cohortId: string) {
  await requireAdmin()

  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: { layoffCohortId: cohortId },
  })
  captureServerEvent(candidateId, 'candidate_matched_to_layoff_cohort', { cohortId })
  revalidatePath('/support/admin/layoff-cohorts')
}

export async function unassignCandidateFromCohort(candidateId: string) {
  await requireAdmin()

  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: { layoffCohortId: null },
  })
  revalidatePath('/support/admin/layoff-cohorts')
}
