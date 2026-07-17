'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCoachByToken } from '@/lib/coach/access'
import { ACCENT_COLOR_OPTIONS } from '@/lib/constants/coach-branding'

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
