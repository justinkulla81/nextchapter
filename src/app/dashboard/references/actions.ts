'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { sendReferenceRequestEmail } from '@/lib/email/send-reference-request'
import type { ReferenceType } from '@prisma/client'

export type FormState = { error?: string; sent?: boolean } | undefined

const VALID_TYPES: ReferenceType[] = [
  'DIRECT_MANAGER',
  'SKIP_LEVEL_MANAGER',
  'PEER',
  'DIRECT_REPORT',
  'CLIENT',
  'VENDOR',
  'FACULTY_ADVISOR',
  'OTHER',
]

export async function updateKnownFor(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You need to be logged in to do this.' }
  }

  const knownFor = (formData.get('knownFor') as string | null)?.trim()
  if (!knownFor) {
    return { error: 'Please answer this before saving.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { knownFor },
  })

  revalidatePath('/dashboard/profile')
}

export async function requestReference(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You need to be logged in to do this.' }
  }

  const refereeName = (formData.get('refereeName') as string | null)?.trim()
  const refereeEmail = (formData.get('refereeEmail') as string | null)?.trim()
  const relationshipType = formData.get('relationshipType') as ReferenceType | null

  if (!refereeName || !refereeEmail || !relationshipType || !VALID_TYPES.includes(relationshipType)) {
    return { error: 'Please fill in their name, email, and how you worked together.' }
  }

  const yearsWorkedTogether = formData.get('yearsWorkedTogether')

  const profile = await getOrCreateCandidateProfile(user.id)

  if (!profile.assessmentComplete) {
    return {
      error: 'Please complete the Work Style Assessment before requesting a reference.',
    }
  }

  const reference = await prisma.reference.create({
    data: {
      candidateId: profile.id,
      refereeName,
      refereeEmail,
      refereeTitle: (formData.get('refereeTitle') as string | null) || null,
      refereeCompany: (formData.get('refereeCompany') as string | null) || null,
      relationshipType,
      yearsWorkedTogether: yearsWorkedTogether ? Number(yearsWorkedTogether) : null,
    },
  })

  const candidateName = profile.displayName || 'A NextChapter candidate'

  await sendReferenceRequestEmail({
    refereeEmail: reference.refereeEmail,
    refereeName: reference.refereeName,
    candidateName,
    token: reference.token,
  })

  revalidatePath('/dashboard/references')
}
