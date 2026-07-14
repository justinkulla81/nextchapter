'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { getOrCreateCoachConversation } from '@/lib/coach/get-conversation'
import { generateCoachReply } from '@/lib/coach/generate-reply'

export type FormState = { error?: string } | undefined

export async function sendCoachMessage(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You need to be logged in to do this.' }
  }

  const content = (formData.get('content') as string | null)?.trim()
  if (!content) {
    return { error: 'Type a message first.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)
  const conversation = await getOrCreateCoachConversation(profile.id)

  await prisma.coachMessage.create({
    data: { conversationId: conversation.id, role: 'user', content },
  })

  const reply = await generateCoachReply(conversation.id, profile.id, content)

  await prisma.coachMessage.create({
    data: { conversationId: conversation.id, role: 'assistant', content: reply },
  })

  revalidatePath('/dashboard')
}
