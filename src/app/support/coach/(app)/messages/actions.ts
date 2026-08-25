'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { sendMessage, markThreadRead } from '@/lib/messaging/threads'
import { captureServerEvent } from '@/lib/posthog/server'

async function requireCoach() {
  const supabase = await createClient('coach')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.coach.findUnique({ where: { userId: user.id } })
}

export type SendCoachMessageState = { error?: string } | undefined

export async function sendCoachMessage(
  _prevState: SendCoachMessageState,
  formData: FormData
): Promise<SendCoachMessageState> {
  const coach = await requireCoach()
  if (!coach) return { error: 'You need to be logged in to do this.' }

  const threadId = formData.get('threadId') as string | null
  const body = (formData.get('body') as string | null) ?? ''
  if (!threadId) return { error: 'Thread not found.' }

  const thread = await prisma.messageThread.findUnique({ where: { id: threadId } })
  if (!thread || thread.coachId !== coach.id) return { error: 'Thread not found.' }

  try {
    await sendMessage(threadId, 'COACH', body)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not send message.' }
  }

  captureServerEvent(coach.id, 'message_sent', { threadId, senderRole: 'COACH' })
  revalidatePath(`/support/coach/messages/${threadId}`)
  return undefined
}

export async function markCoachThreadRead(threadId: string) {
  const coach = await requireCoach()
  if (!coach) return

  const thread = await prisma.messageThread.findUnique({ where: { id: threadId } })
  if (!thread || thread.coachId !== coach.id) return

  await markThreadRead(threadId, 'partner')
  captureServerEvent(coach.id, 'thread_read', { threadId, side: 'partner' })
}
