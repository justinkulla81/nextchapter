'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCoachByToken } from '@/lib/coach/access'
import { ACCENT_COLOR_OPTIONS } from '@/lib/constants/coach-branding'
import { saveCoachTemplate, type EffectiveTemplateQuestion } from '@/lib/coach/onboarding-form'
import { captureServerEvent } from '@/lib/posthog/server'
import { uploadAvatarFile } from '@/lib/avatar/avatar'
import type { AvatarUploadState } from '@/components/ui/avatar-upload-form'

export type BrandingFormState = { error?: string } | undefined

export async function updateCoachBranding(
  token: string,
  _prevState: BrandingFormState,
  formData: FormData
): Promise<BrandingFormState> {
  const coach = await getCoachByToken(token)
  if (!coach) return { error: 'This link isn’t valid.' }

  const firmName = (formData.get('firmName') as string | null)?.trim() || null
  const accentColor = (formData.get('accentColor') as string | null) || null
  if (accentColor && !ACCENT_COLOR_OPTIONS.some((o) => o.value === accentColor)) {
    return { error: 'Please choose one of the listed colors.' }
  }

  const file = formData.get('logo') as File | null
  let logoUrl: string | undefined

  if (file && file.size > 0) {
    if (file.size > 2 * 1024 * 1024) {
      return { error: 'Logo must be under 2MB.' }
    }
    const admin = createAdminClient()
    const ext = file.name.split('.').pop()
    const path = `${coach.id}/${crypto.randomUUID()}${ext ? `.${ext}` : ''}`
    const { error: uploadError } = await admin.storage
      .from('coach-logos')
      .upload(path, file, { contentType: file.type || undefined })
    if (uploadError) {
      return { error: 'Something went wrong uploading your logo. Please try again.' }
    }
    logoUrl = admin.storage.from('coach-logos').getPublicUrl(path).data.publicUrl
  }

  await prisma.coach.update({
    where: { id: coach.id },
    data: {
      firmName,
      accentColor,
      ...(logoUrl ? { logoUrl } : {}),
    },
  })

  revalidatePath(`/support/coach/settings/${token}`)
}

export type SaveOnboardingTemplateResult = { error?: string } | undefined

// Prompt 60 — saves the coach's standing question set for the candidate-
// completed Coaching Onboarding Form. Applied automatically to every new
// client; not reconfigured per client.
export async function saveOnboardingTemplate(
  token: string,
  template: EffectiveTemplateQuestion[]
): Promise<SaveOnboardingTemplateResult> {
  const coach = await getCoachByToken(token)
  if (!coach) return { error: 'This link isn’t valid.' }

  for (const q of template) {
    if (!q.label.trim()) return { error: 'Every question needs text.' }
    if (q.type === 'multiple_choice' && (!q.options || q.options.filter((o) => o.trim()).length < 2)) {
      return { error: 'Multiple-choice questions need at least two options.' }
    }
    if (q.type === 'scale' && (!q.scaleMax || q.scaleMax < 2)) {
      return { error: 'Scale questions need a maximum of at least 2.' }
    }
  }

  await saveCoachTemplate(coach.id, template)
  captureServerEvent(coach.id, 'coaching_onboarding_template_saved', { questionCount: template.length })
  revalidatePath(`/support/coach/settings/${token}`)
}

export async function uploadMyProfilePicture(
  token: string,
  _prevState: AvatarUploadState,
  formData: FormData
): Promise<AvatarUploadState> {
  const coach = await getCoachByToken(token)
  if (!coach) return { error: 'This link isn’t valid.' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Choose a photo first.' }

  const result = await uploadAvatarFile(coach.id, file)
  if (result.error) return { error: result.error }

  await prisma.coach.update({ where: { id: coach.id }, data: { profilePictureUrl: result.url } })
  captureServerEvent(coach.id, 'profile_picture_uploaded')
  revalidatePath(`/support/coach/settings/${token}`)
  return undefined
}

export async function removeMyProfilePicture(token: string): Promise<void> {
  const coach = await getCoachByToken(token)
  if (!coach) return

  await prisma.coach.update({ where: { id: coach.id }, data: { profilePictureUrl: null } })
  captureServerEvent(coach.id, 'profile_picture_removed')
  revalidatePath(`/support/coach/settings/${token}`)
}
