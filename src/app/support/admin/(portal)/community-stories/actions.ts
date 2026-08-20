'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { getSystemCandidateProfile } from '@/lib/community/system-account'
import { createAdminStoryPost } from '@/lib/community/admin-story'

export type FormState = { error?: string } | undefined

export async function createAdminStoryAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin()

  const title = (formData.get('title') as string | null)?.trim() || null
  const description = (formData.get('description') as string | null)?.trim()
  const externalUrl = (formData.get('externalUrl') as string | null)?.trim() || null

  if (!description) {
    return { error: 'Write the story first.' }
  }

  await createAdminStoryPost(admin.email, { title, description, externalUrl })

  revalidatePath('/support/admin/community-stories')
  revalidatePath('/dashboard/community')
  revalidatePath('/dashboard')
  return undefined
}

export async function removeAdminStoryAction(postId: string) {
  await requireAdmin()
  const system = await getSystemCandidateProfile()
  // Scoped to the system account's own posts — this action can only ever
  // touch admin stories, never a real candidate's post, regardless of what
  // postId a caller passes in.
  await prisma.communityPost.updateMany({
    where: { id: postId, candidateId: system.id },
    data: { isActive: false },
  })
  revalidatePath('/support/admin/community-stories')
  revalidatePath('/dashboard/community')
}
