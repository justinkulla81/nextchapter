'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { reviewStory } from '@/lib/layoff-stories/store'

async function decide(id: string, decision: 'APPROVED' | 'REJECTED', formData: FormData, slug: string | null) {
  await requireAdmin()
  await reviewStory(id, decision, String(formData.get('note') ?? '').trim() || null)
  revalidatePath('/support/admin/layoff-stories')
  if (slug) revalidatePath(`/layoffs/company/${slug}`)
}

export async function approveStoryAction(id: string, slug: string | null, formData: FormData) {
  await decide(id, 'APPROVED', formData, slug)
}

export async function rejectStoryAction(id: string, slug: string | null, formData: FormData) {
  await decide(id, 'REJECTED', formData, slug)
}
