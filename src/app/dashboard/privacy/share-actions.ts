'use server'

import { revalidatePath } from 'next/cache'
import type { ShareRecipientType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'

const EXPIRY_DAYS: Record<string, number | null> = { '7': 7, '30': 30, never: null }

export type CreateShareState = { error?: string } | undefined

export async function createProfileShare(
  _prevState: CreateShareState,
  formData: FormData
): Promise<CreateShareState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to do this.' }

  const profile = await getOrCreateCandidateProfile(user.id)

  const recipientType = formData.get('recipientType') as ShareRecipientType | null
  if (!recipientType || !['HIRING_MANAGER', 'RECRUITER', 'COACH'].includes(recipientType)) {
    return { error: 'Choose who this link is for.' }
  }

  const activeProcess = formData.get('activeProcess') === 'true'
  const includeExtras = formData.getAll('includeExtras').map(String)
  const expiryOption = (formData.get('expiryOption') as string | null) ?? '30'
  const label = (formData.get('label') as string | null)?.trim() || null

  const days = EXPIRY_DAYS[expiryOption] ?? 30
  const expiresAt = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null

  await prisma.profileShare.create({
    data: {
      candidateId: profile.id,
      recipientType,
      activeProcess,
      includeExtras,
      expiresAt,
      label,
    },
  })

  captureServerEvent(profile.id, 'profile_share_created', {})

  revalidatePath('/dashboard/privacy')
}

export async function revokeProfileShare(shareId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)

  await prisma.profileShare.updateMany({
    where: { id: shareId, candidateId: profile.id },
    data: { revokedAt: new Date() },
  })

  revalidatePath('/dashboard/privacy')
}
