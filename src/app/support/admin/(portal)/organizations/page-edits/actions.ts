'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { approvePageEdit, declinePageEdit } from '@/lib/public-page/store'

export type PageEditState = { ok: boolean; message: string } | undefined

export async function approvePageEditAction(id: string, _prev: PageEditState): Promise<PageEditState> {
  const admin = await requireAdmin()
  const r = await approvePageEdit(id, admin.email ?? 'admin')
  if (!r.ok) return { ok: false, message: r.error ?? 'Could not approve it.' }
  revalidatePath('/support/admin/organizations/page-edits')
  return { ok: true, message: 'Approved and published. Their later saves publish without review.' }
}

export async function declinePageEditAction(id: string, _prev: PageEditState, formData: FormData): Promise<PageEditState> {
  const admin = await requireAdmin()
  const r = await declinePageEdit(id, String(formData.get('note') ?? ''), admin.email ?? 'admin')
  if (!r.ok) return { ok: false, message: r.error ?? 'Could not send it back.' }
  revalidatePath('/support/admin/organizations/page-edits')
  return { ok: true, message: 'Sent back with your note. Nothing was published.' }
}
