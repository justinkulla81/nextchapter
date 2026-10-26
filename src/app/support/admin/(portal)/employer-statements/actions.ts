'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { reviewStatement } from '@/lib/employer-statements/store'

async function decide(id: string, decision: 'APPROVED' | 'REJECTED', formData: FormData, slug: string) {
  await requireAdmin()
  await reviewStatement(id, decision, String(formData.get('note') ?? '').trim() || null)
  revalidatePath('/support/admin/employer-statements')
  revalidatePath(`/layoffs/company/${slug}`)
  revalidatePath(`/network/company/${slug}`)
}

export async function approveStatementAction(id: string, slug: string, formData: FormData) {
  await decide(id, 'APPROVED', formData, slug)
}

export async function rejectStatementAction(id: string, slug: string, formData: FormData) {
  await decide(id, 'REJECTED', formData, slug)
}
