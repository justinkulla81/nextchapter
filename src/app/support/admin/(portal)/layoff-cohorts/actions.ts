'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { syncAutoJoinedCommunities } from '@/lib/community/communities'

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

  // Ex-Company community exists from the moment the cohort does, not just
  // once the first candidate is assigned — see syncAutoJoinedCommunities,
  // which upserts on the same [type, value] key and no-ops if this already
  // matches.
  await prisma.community.upsert({
    where: { type_value: { type: 'EX_COMPANY', value: companyName } },
    create: { type: 'EX_COMPANY', value: companyName, label: `Ex-${companyName}`, layoffCohortId: cohort.id },
    update: {},
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

  // Fires the same explicit, named auto-join banner ("You've been added to:
  // Ex-Acme Corp") for an admin-assigned match as for self-service City/
  // Function/Industry ones — never a silent match.
  await syncAutoJoinedCommunities(candidateId)

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
