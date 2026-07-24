'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { sendMessage, markThreadRead } from '@/lib/messaging/threads'
import { captureServerEvent } from '@/lib/posthog/server'

async function requireEmployer() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.employerProfile.findUnique({ where: { userId: user.id } })
}

export type SendEmployerMessageState = { error?: string } | undefined

export async function sendEmployerMessage(
  _prevState: SendEmployerMessageState,
  formData: FormData
): Promise<SendEmployerMessageState> {
  const employer = await requireEmployer()
  if (!employer) return { error: 'You need to be logged in to do this.' }

  const threadId = formData.get('threadId') as string | null
  const body = (formData.get('body') as string | null) ?? ''
  if (!threadId) return { error: 'Thread not found.' }

  const thread = await prisma.messageThread.findUnique({ where: { id: threadId } })
  if (!thread || thread.employerId !== employer.id) return { error: 'Thread not found.' }

  try {
    await sendMessage(threadId, 'EMPLOYER', body)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not send message.' }
  }

  captureServerEvent(employer.id, 'message_sent', { threadId, senderRole: 'EMPLOYER' })
  revalidatePath(`/talent/messages/${threadId}`)
  return undefined
}

export async function markEmployerThreadRead(threadId: string) {
  const employer = await requireEmployer()
  if (!employer) return

  const thread = await prisma.messageThread.findUnique({ where: { id: threadId } })
  if (!thread || thread.employerId !== employer.id) return

  await markThreadRead(threadId, 'partner')
  captureServerEvent(employer.id, 'thread_read', { threadId, side: 'partner' })
}
