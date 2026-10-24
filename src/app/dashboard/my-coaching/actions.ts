'use server'

import { revalidatePath } from 'next/cache'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { redeemCoachCode } from '@/lib/access/grants'
import { captureServerEvent } from '@/lib/posthog/server'
import { decideTopic, markSummaryViewed } from '@/lib/coach/session-notes-service'

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

export type TopicDecision = { ok: true } | { ok: false; error: string }

/** The member opened the coach's update: clears the notice on Home. Best effort. */
export async function markCoachSummaryViewed(summaryId: string): Promise<void> {
  const profile = await getDashboardProfile()
  if (await markSummaryViewed(profile.id, summaryId)) revalidatePath('/dashboard', 'layout')
}

/** Accept or dismiss a topic the coach confirmed. Accepting changes the learning plan on its next load. */
export async function decideCoachTopic(topicId: string, decision: 'accepted' | 'dismissed'): Promise<TopicDecision> {
  const profile = await getDashboardProfile()
  if (decision !== 'accepted' && decision !== 'dismissed') return { ok: false, error: 'Choose Accept or Dismiss.' }
  try {
    const r = await decideTopic(profile.id, topicId, decision)
    if (!r.ok) return r
    revalidatePath('/dashboard/my-coaching')
    revalidatePath('/dashboard/learning')
    return { ok: true }
  } catch (error) {
    console.error('Failed to save a topic decision:', error)
    return { ok: false, error: 'We could not save that just now. Your choice was not changed. Try again in a moment.' }
  }
}
