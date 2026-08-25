'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { sendMessage, markThreadRead } from '@/lib/messaging/threads'
import { captureServerEvent } from '@/lib/posthog/server'

async function requireRecruiter() {
  const supabase = await createClient('recruiter')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.recruiter.findUnique({ where: { userId: user.id } })
}

export type SendRecruiterMessageState = { error?: string } | undefined

export async function sendRecruiterMessage(
  _prevState: SendRecruiterMessageState,
  formData: FormData
): Promise<SendRecruiterMessageState> {
  const recruiter = await requireRecruiter()
  if (!recruiter) return { error: 'You need to be logged in to do this.' }

  const threadId = formData.get('threadId') as string | null
  const body = (formData.get('body') as string | null) ?? ''
  if (!threadId) return { error: 'Thread not found.' }

  const thread = await prisma.messageThread.findUnique({ where: { id: threadId } })
  if (!thread || thread.recruiterId !== recruiter.id) return { error: 'Thread not found.' }

  try {
    await sendMessage(threadId, 'RECRUITER', body)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not send message.' }
  }

  captureServerEvent(recruiter.id, 'message_sent', { threadId, senderRole: 'RECRUITER' })
  revalidatePath(`/recruiters/messages/${threadId}`)
  return undefined
}

export async function markRecruiterThreadRead(threadId: string) {
  const recruiter = await requireRecruiter()
  if (!recruiter) return

  const thread = await prisma.messageThread.findUnique({ where: { id: threadId } })
  if (!thread || thread.recruiterId !== recruiter.id) return

  await markThreadRead(threadId, 'partner')
  captureServerEvent(recruiter.id, 'thread_read', { threadId, side: 'partner' })
}
