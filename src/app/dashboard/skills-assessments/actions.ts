'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'

export type FormState = { error?: string; success?: boolean } | undefined

export async function updateSkillsToBuild(
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

  const profile = await getOrCreateCandidateProfile(user.id)
  const skillsToBuild = formData.getAll('skillsToBuild') as string[]

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { skillsToBuild },
  })

  captureServerEvent(profile.id, 'skills_to_build_updated', { count: skillsToBuild.length })

  revalidatePath('/dashboard/skills-assessments')
  revalidatePath('/dashboard')

  return { success: true }
}
