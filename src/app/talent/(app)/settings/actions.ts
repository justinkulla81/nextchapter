'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { uploadAvatarFile } from '@/lib/avatar/avatar'
import type { AvatarUploadState } from '@/components/ui/avatar-upload-form'

export async function updateCompanyInfo(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const companyName = (formData.get('companyName') as string | null)?.trim()
  if (!companyName) return

  await prisma.employerProfile.update({
    where: { userId: user.id },
    data: {
      companyName,
      companyWebsite: (formData.get('companyWebsite') as string | null)?.trim() || null,
      companySize: (formData.get('companySize') as string | null) || null,
      companyStage: (formData.get('companyStage') as string | null) || null,
    },
  })

  revalidatePath('/talent/settings')
}

async function requireEmployer() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.employerProfile.findUnique({ where: { userId: user.id } })
}

export async function uploadMyProfilePicture(
  _prevState: AvatarUploadState,
  formData: FormData
): Promise<AvatarUploadState> {
  const employer = await requireEmployer()
  if (!employer) return { error: 'You need to be logged in to do this.' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Choose a photo first.' }

  const result = await uploadAvatarFile(employer.id, file)
  if (result.error) return { error: result.error }

  await prisma.employerProfile.update({ where: { id: employer.id }, data: { profilePictureUrl: result.url } })
  captureServerEvent(employer.id, 'profile_picture_uploaded')
  revalidatePath('/talent/settings')
  return undefined
}

export async function removeMyProfilePicture(): Promise<void> {
  const employer = await requireEmployer()
  if (!employer) return

  await prisma.employerProfile.update({ where: { id: employer.id }, data: { profilePictureUrl: null } })
  captureServerEvent(employer.id, 'profile_picture_removed')
  revalidatePath('/talent/settings')
}

export async function toggleMyProfilePictureVisible(current: boolean): Promise<void> {
  const employer = await requireEmployer()
  if (!employer) return

  await prisma.employerProfile.update({ where: { id: employer.id }, data: { profilePictureVisible: !current } })
  captureServerEvent(employer.id, 'profile_picture_visibility_toggled', { visible: !current })
  revalidatePath('/talent/settings')
}
