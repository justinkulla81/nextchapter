'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { fixAllCapsCompanyName } from '@/lib/text/org-name-match'
import { linkPostingToCompany } from '@/lib/companies/posting-company'
import { requireInstitutionCapabilityForAction } from '@/lib/institution/auth'

export type InstitutionJobState = { error?: string; ok?: boolean } | undefined

// A role this college wants only its own alumni to see. It is created PENDING: a
// NextChapter admin approves it from the usual queue before any alumnus can open it, the
// same review every employer-submitted posting gets.
export async function postAlumniJob(_prev: InstitutionJobState, formData: FormData): Promise<InstitutionJobState> {
  const user = await requireInstitutionCapabilityForAction('post_jobs')
  if (!user) return { error: 'You do not have access to post jobs.' }

  const get = (k: string) => (formData.get(k) as string | null)?.trim() || ''
  const title = get('title')
  const companyName = fixAllCapsCompanyName(get('companyName'))
  const url = get('url')
  if (!title) return { error: 'Job title is required.' }
  if (!companyName) return { error: 'Company name is required.' }
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('protocol')
  } catch {
    return { error: 'A real link to the posting is required.' }
  }
  const salaryMin = get('salaryMin') ? Number(get('salaryMin')) : null
  const salaryMax = get('salaryMax') ? Number(get('salaryMax')) : null
  if ((salaryMin !== null && !Number.isFinite(salaryMin)) || (salaryMax !== null && !Number.isFinite(salaryMax))) {
    return { error: 'Salary must be a number.' }
  }
  if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) {
    return { error: 'Salary minimum cannot be higher than the maximum.' }
  }

  const existing = await prisma.exclusiveJobPosting.findFirst({ where: { url }, select: { id: true } })
  if (existing) return { error: 'This posting is already on NextChapter.' }

  const posting = await prisma.exclusiveJobPosting.create({
    data: {
      title,
      companyName,
      companyId: await linkPostingToCompany(companyName),
      location: get('location') || null,
      url,
      description: get('description') || null,
      postingType: 'direct',
      salaryMin,
      salaryMax,
      salaryCurrency: 'USD',
      audienceTier: 'ALL_CANDIDATES',
      distribution: 'OPEN',
      disclosure: 'OPEN',
      status: 'pending',
      source: 'institution',
      addedBy: user.email ?? 'institution',
      institutionScopeId: user.institutionId,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    },
  })
  captureServerEvent(user.userId, 'institution_alumni_job_posted', { institutionId: user.institutionId, postingId: posting.id })
  revalidatePath('/institution/jobs')
  return { ok: true }
}

export async function archiveAlumniJob(postingId: string): Promise<void> {
  const user = await requireInstitutionCapabilityForAction('post_jobs')
  if (!user) return
  // Scoped to this college: another college's posting id changes nothing.
  await prisma.exclusiveJobPosting.updateMany({
    where: { id: postingId, institutionScopeId: user.institutionId },
    data: { archivedAt: new Date() },
  })
  captureServerEvent(user.userId, 'institution_alumni_job_archived', { institutionId: user.institutionId })
  revalidatePath('/institution/jobs')
}
