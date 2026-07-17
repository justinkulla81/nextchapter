'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'

export type FormState = { error?: string } | undefined

export async function createExclusiveJobPosting(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin()

  const title = (formData.get('title') as string | null)?.trim()
  const companyName = (formData.get('companyName') as string | null)?.trim()
  const location = (formData.get('location') as string | null)?.trim()
  const url = (formData.get('url') as string | null)?.trim()
  const description = (formData.get('description') as string | null)?.trim()

  if (!title) return { error: 'Job title is required.' }
  if (!companyName) return { error: 'Company name is required.' }
  if (!url) return { error: 'A real posting URL is required — no fabricated listings.' }

  const posting = await prisma.exclusiveJobPosting.create({
    data: {
      title,
      companyName,
      location: location || null,
      url,
      description: description || null,
      addedBy: admin?.email ?? 'unknown',
    },
  })

  captureServerEvent(posting.id, 'exclusive_job_posted', { companyName })

  revalidatePath('/support/admin/exclusive-jobs')
}

export async function archiveExclusiveJobPosting(postingId: string) {
  await requireAdmin()

  await prisma.exclusiveJobPosting.update({ where: { id: postingId }, data: { archivedAt: new Date() } })
  revalidatePath('/support/admin/exclusive-jobs')
}
