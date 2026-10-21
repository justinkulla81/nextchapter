'use server'

import { revalidatePath } from 'next/cache'
import { sendCheer } from '@/lib/supporters/supporters'

export async function sendCheerAction(token: string, _prev: { ok?: boolean; error?: string } | null, formData: FormData) {
  const r = await sendCheer(token, String(formData.get('message') ?? ''))
  if (r.ok) revalidatePath(`/supporter/${token}`)
  return r.ok ? { ok: true } : { error: r.error }
}
