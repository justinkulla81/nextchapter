'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { captureServerEvent } from '@/lib/posthog/server'
import { uploadAvatarFile } from '@/lib/avatar/avatar'
import type { AvatarUploadState } from '@/components/ui/avatar-upload-form'

async function requireRecruiter() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.recruiter.findUnique({ where: { userId: user.id } })
}

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

export async function uploadMyProfilePicture(
  _prevState: AvatarUploadState,
  formData: FormData
): Promise<AvatarUploadState> {
  const recruiter = await requireRecruiter()
  if (!recruiter) return { error: 'You need to be logged in to do this.' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Choose a photo first.' }

  const result = await uploadAvatarFile(recruiter.id, file)
  if (result.error) return { error: result.error }

  await prisma.recruiter.update({ where: { id: recruiter.id }, data: { profilePictureUrl: result.url } })
  captureServerEvent(recruiter.id, 'profile_picture_uploaded')
  revalidatePath('/recruiters/settings')
  return undefined
}

export async function removeMyProfilePicture(): Promise<void> {
  const recruiter = await requireRecruiter()
  if (!recruiter) return

  await prisma.recruiter.update({ where: { id: recruiter.id }, data: { profilePictureUrl: null } })
  captureServerEvent(recruiter.id, 'profile_picture_removed')
  revalidatePath('/recruiters/settings')
}

// §A6.2 — "branded submission packet ... with the recruiter's own logo."
// Any recruiter linked to a firm can upload/replace that firm's logo
// (shared across every recruiter at the firm, same as the firm name
// itself) — admin verification/status of the firm is unaffected either way,
// this is branding, not a trust signal.
export async function uploadMyFirmLogo(
  _prevState: AvatarUploadState,
  formData: FormData
): Promise<AvatarUploadState> {
  const recruiter = await requireRecruiter()
  if (!recruiter) return { error: 'You need to be logged in to do this.' }
  if (!recruiter.recruiterFirmId) return { error: 'Your account isn\'t linked to a firm yet.' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Choose an image first.' }

  const result = await uploadAvatarFile(recruiter.recruiterFirmId, file)
  if (result.error) return { error: result.error }

  await prisma.recruiterFirm.update({ where: { id: recruiter.recruiterFirmId }, data: { logoUrl: result.url } })
  captureServerEvent(recruiter.id, 'recruiter_firm_logo_uploaded', { firmId: recruiter.recruiterFirmId })
  revalidatePath('/recruiters/settings')
  return undefined
}

export async function removeMyFirmLogo(): Promise<void> {
  const recruiter = await requireRecruiter()
  if (!recruiter || !recruiter.recruiterFirmId) return

  await prisma.recruiterFirm.update({ where: { id: recruiter.recruiterFirmId }, data: { logoUrl: null } })
  captureServerEvent(recruiter.id, 'recruiter_firm_logo_removed', { firmId: recruiter.recruiterFirmId })
  revalidatePath('/recruiters/settings')
}
