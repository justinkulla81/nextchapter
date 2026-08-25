'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import type { CrucibleFunctionInterest } from '@prisma/client'

export async function completeCrucibleEmployerOnboarding(formData: FormData): Promise<void> {
  const companyWebsite = (formData.get('companyWebsite') as string | null)?.trim() || null
  const companySize = (formData.get('companySize') as string | null) || null
  const functionInterest = formData.get('functionInterest') as CrucibleFunctionInterest

  const supabase = await createClient('nen')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/noexperience/employers/login')

  const profile = await prisma.crucibleEmployerProfile.findUnique({ where: { userId: user.id } })
  if (!profile) redirect('/noexperience/employers/signup')

  await prisma.crucibleEmployerProfile.update({
    where: { id: profile.id },
    data: { companyWebsite, companySize, functionInterest, onboardingCompletedAt: new Date() },
  })

  captureServerEvent(user.id, 'employer_company_info_submitted', {
    companySize,
    hasWebsite: !!companyWebsite,
  })
  captureServerEvent(user.id, 'employer_function_interest_selected', { functionInterest })

  redirect('/noexperience/employers/candidates')
}
