'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { sendEncouragementNote, markEncouragementNoteRead } from '@/lib/community/encouragement'

async function getAuthedProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

export type EncouragementFormState = { error?: string; sent?: boolean } | undefined

export async function submitEncouragementNote(
  _prevState: EncouragementFormState,
  formData: FormData
): Promise<EncouragementFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const message = (formData.get('message') as string | null)?.trim()
  if (!message) return { error: 'Write a short note first.' }

  const revealSender = formData.get('revealSender') === 'on'
  const result = await sendEncouragementNote(profile.id, message, revealSender)
  revalidatePath('/dashboard/community')

  if (!result.sent) {
    return { error: 'No one needs a note right now — check back later.' }
  }
  return { sent: true }
}

export async function dismissEncouragementNote(noteId: string) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await markEncouragementNoteRead(noteId, profile.id)
  revalidatePath('/dashboard/community')
}

export async function toggleEncouragementGiving(current: boolean) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { encouragementGivingOptIn: !current },
  })
  revalidatePath('/dashboard/community')
  revalidatePath('/dashboard/privacy')
}

export async function toggleAListOptOut(current: boolean) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { aListOptOut: !current } })
  revalidatePath('/dashboard/privacy')
}
