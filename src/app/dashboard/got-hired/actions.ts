'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateCandidateProfile } from '@/lib/profile'

export type FormState = { error?: string; submitted?: boolean } | undefined

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function submitBountyClaim(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to do this.' }

  const profile = await getOrCreateCandidateProfile(user.id)

  const companyName = (formData.get('companyName') as string | null)?.trim()
  const roleTitle = (formData.get('roleTitle') as string | null)?.trim()
  const startDateRaw = formData.get('startDate') as string | null
  const file = formData.get('offerLetter') as File | null

  if (!companyName || !roleTitle || !startDateRaw) {
    return { error: 'Fill in the company, role, and start date.' }
  }
  const startDate = new Date(startDateRaw)
  if (Number.isNaN(startDate.getTime())) {
    return { error: 'Enter a valid start date.' }
  }
  if (!file || file.size === 0) {
    return { error: 'Upload your offer letter or written confirmation of employment.' }
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: 'File is too large — please upload something under 10MB.' }
  }
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !['pdf', 'png', 'jpg', 'jpeg'].includes(ext)) {
    return { error: 'Please upload a PDF or image (PNG/JPG) of your offer letter.' }
  }

  const admin = createAdminClient()
  const path = `${profile.id}/${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await admin.storage
    .from('offer-letters')
    .upload(path, file, { contentType: file.type || undefined })

  if (uploadError) {
    return { error: 'Something went wrong uploading your file. Please try again.' }
  }

  await prisma.bountyClaim.create({
    data: {
      candidateId: profile.id,
      companyName,
      roleTitle,
      startDate,
      offerLetterUrl: path,
    },
  })

  revalidatePath('/dashboard/got-hired')
  return { submitted: true }
}
