'use server'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { captureServerEvent } from '@/lib/posthog/server'

export type UpdateRecruiterSettingsState = { error?: string; success?: boolean } | undefined

export async function updateRecruiterSettings(
  _prevState: UpdateRecruiterSettingsState,
  formData: FormData
): Promise<UpdateRecruiterSettingsState> {
  const fullName = (formData.get('fullName') as string | null)?.trim()
  const firmName = (formData.get('firmName') as string | null)?.trim() || null
  const specialty = (formData.get('specialty') as string | null)?.trim() || null

  if (!fullName) {
    return { error: 'Please fill in your name.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong loading your session. Please try again.' }

  const recruiter = await prisma.recruiter.findUnique({ where: { userId: user.id } })
  if (!recruiter) return { error: 'No recruiter profile found for this account.' }

  await prisma.recruiter.update({
    where: { id: recruiter.id },
    data: { fullName, firmName, specialty },
  })

  captureServerEvent(recruiter.id, 'recruiter_settings_updated', { recruiterId: recruiter.id })

  return { success: true }
}
