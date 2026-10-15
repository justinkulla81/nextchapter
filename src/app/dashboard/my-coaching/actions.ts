'use server'

import { revalidatePath } from 'next/cache'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { redeemCoachCode } from '@/lib/access/grants'
import { captureServerEvent } from '@/lib/posthog/server'

export type RedeemState = { error?: string; ok?: string; code?: string } | undefined

export async function redeemCode(_prev: RedeemState, fd: FormData): Promise<RedeemState> {
  const profile = await getDashboardProfile()
  const code = String(fd.get('code') ?? '')
  if (!code.trim()) return { error: 'Enter the code your coach gave you.', code }
  const r = await redeemCoachCode(profile.id, code)
  captureServerEvent(profile.id, r.ok ? 'coach_access_code_redeemed' : 'coach_access_code_redeem_failed', { candidateId: profile.id, sessions: r.ok ? r.sessions : null, reason: r.error ?? null })
  if (!r.ok) return { error: r.error, code }
  revalidatePath('/dashboard', 'layout')
  return { ok: `Done. You have ${r.sessions} session${r.sessions === 1 ? '' : 's'} with your coach.` }
}
