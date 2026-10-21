'use server'

import { revalidatePath } from 'next/cache'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { inviteSupporter, revokeSupporter } from '@/lib/supporters/supporters'

export async function inviteSupporterAction(_prev: { ok?: boolean; error?: string } | null, formData: FormData) {
  const profile = await getDashboardProfile()
  const r = await inviteSupporter(profile.id, String(formData.get('name') ?? ''), String(formData.get('email') ?? ''))
  if (r.ok) revalidatePath('/dashboard/supporters')
  return r.ok ? { ok: true } : { error: r.error }
}

export async function removeSupporterAction(supporterId: string) {
  const profile = await getDashboardProfile()
  await revokeSupporter(profile.id, supporterId)
  revalidatePath('/dashboard/supporters')
}
