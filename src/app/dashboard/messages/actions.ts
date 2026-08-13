'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { sendMessage, markThreadRead, getOrCreateThread } from '@/lib/messaging/threads'
import { captureServerEvent } from '@/lib/posthog/server'
import type { ThreadPartnerType } from '@prisma/client'

async function getAuthedProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

export type SendCandidateMessageState = { error?: string } | undefined

export async function sendCandidateMessage(
  _prevState: SendCandidateMessageState,
  formData: FormData
): Promise<SendCandidateMessageState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const threadId = formData.get('threadId') as string | null
  const body = (formData.get('body') as string | null) ?? ''
  if (!threadId) return { error: 'Thread not found.' }

  const thread = await prisma.messageThread.findUnique({ where: { id: threadId } })
  if (!thread || thread.candidateId !== profile.id) return { error: 'Thread not found.' }

  try {
    await sendMessage(threadId, 'CANDIDATE', body)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not send message.' }
  }

  captureServerEvent(profile.id, 'message_sent', { threadId, senderRole: 'CANDIDATE' })
  revalidatePath('/dashboard/community')
  return undefined
}

// Candidate-initiated contact — net-new (see threads.ts's header comment on
// getCandidateEligibleRecruiters/getCandidateEligibleEmployers). Only ever
// called with a partnerId already surfaced by one of those two queries, so
// assertThreadAllowed's existing gate always passes; still real, not
// bypassed, since getOrCreateThread re-checks it itself.
export async function startCandidateThreadAction(partnerType: ThreadPartnerType, partnerId: string) {
  const profile = await getAuthedProfile()
  if (!profile) return

  const thread = await getOrCreateThread(profile.id, partnerType, partnerId)
  captureServerEvent(profile.id, 'candidate_thread_started', { partnerType, partnerId })

  const relation = partnerType === 'RECRUITER' ? 'recruiters' : 'hiring-managers'
  redirect(`/dashboard/community?tab=messages&relation=${relation}&thread=${thread.id}`)
}

export async function markCandidateThreadRead(threadId: string) {
  const profile = await getAuthedProfile()
  if (!profile) return

  const thread = await prisma.messageThread.findUnique({ where: { id: threadId } })
  if (!thread || thread.candidateId !== profile.id) return

  await markThreadRead(threadId, 'candidate')
  captureServerEvent(profile.id, 'thread_read', { threadId, side: 'candidate' })
}
