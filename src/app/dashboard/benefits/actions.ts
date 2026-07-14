'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { generateBenefitsPlan } from '@/lib/reports/benefits-plan'

export type FormState = { error?: string } | undefined

export async function submitBenefitsUnlock(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You need to be logged in to do this.' }
  }

  const answer = (formData.get('answer') as string | null)?.trim()
  if (!answer) {
    return { error: 'Please answer this before continuing.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { benefitsUnlockAnswer: answer },
  })

  await generateBenefitsPlan(profile.id)

  revalidatePath('/dashboard/benefits')
}
