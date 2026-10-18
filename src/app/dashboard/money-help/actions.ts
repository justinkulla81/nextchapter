'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { createClient } from '@/lib/supabase/server'
import { captureServerEvent } from '@/lib/posthog/server'

async function currentProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  return getOrCreateCandidateProfile(user.id)
}

// Money is personal, so it is the member's choice. Yes turns on Finances and benefits and the pay
// questions. No leaves all of it out. Either can be changed any time. Nothing is deleted when they say no.
export async function setMoneyHelp(formData: FormData): Promise<void> {
  const profile = await currentProfile()
  const choice = formData.get('moneyHelp')
  if (choice !== 'yes' && choice !== 'no') return
  const moneyHelp = choice === 'yes'
  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { moneyHelp } })
  captureServerEvent(profile.id, 'money_help_set', { moneyHelp, previous: profile.moneyHelp, surface: formData.get('surface') === 'onboarding' ? 'onboarding' : 'account' })
  revalidatePath('/dashboard', 'layout')
  redirect(moneyHelp ? '/dashboard/benefits' : '/dashboard/money-help')
}

// Removes the pay and savings numbers the member gave us, and nothing else.
export async function deleteMoneyNumbers(): Promise<void> {
  const profile = await currentProfile()
  const details = { ...((profile.journeyDetails as Record<string, unknown> | null) ?? {}) }
  delete details.cushionMonths
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { lastSalary: null, targetCompMin: null, journeyDetails: details as never },
  })
  captureServerEvent(profile.id, 'money_numbers_deleted', {})
  revalidatePath('/dashboard/money-help')
}
