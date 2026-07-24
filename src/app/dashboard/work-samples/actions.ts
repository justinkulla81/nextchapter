'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { applyWorkSampleUploadedRewrite } from '@/lib/scoring/rewrite-actions'
import { captureServerEvent } from '@/lib/posthog/server'

export type FormState = { error?: string } | undefined

const SAMPLE_TYPES = ['case_study', 'writing', 'code', 'design', 'presentation', 'other']
const PORTFOLIO_TYPES = ['writing', 'code', 'design', 'other', 'none']

export async function submitWorkSampleType(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to do this.' }

  const workSampleType = formData.get('workSampleType') as string | null
  if (!workSampleType || !PORTFOLIO_TYPES.includes(workSampleType)) {
    return { error: 'Please choose an option.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { workSampleType },
  })

  revalidatePath('/dashboard/work-samples')
  revalidatePath('/dashboard')
}

export async function addWorkSample(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You need to be logged in to do this.' }
  }

  const title = (formData.get('title') as string | null)?.trim()
  const description = (formData.get('description') as string | null)?.trim()
  const sampleType = formData.get('sampleType') as string | null
  const externalUrl = (formData.get('externalUrl') as string | null)?.trim() || null
  const file = formData.get('file') as File | null

  if (!title || !description || !sampleType || !SAMPLE_TYPES.includes(sampleType)) {
    return { error: 'Please fill in the title, description, and type.' }
  }

  if (!externalUrl && (!file || file.size === 0)) {
    return { error: 'Add either a file or a link to your work.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)

  let fileUrl: string | null = null

  if (file && file.size > 0) {
    const admin = createAdminClient()
    const ext = file.name.split('.').pop()
    const path = `${profile.id}/${crypto.randomUUID()}${ext ? `.${ext}` : ''}`

    const { error: uploadError } = await admin.storage
      .from('work-samples')
      .upload(path, file, { contentType: file.type || undefined })

    if (uploadError) {
      return { error: 'Something went wrong uploading your file. Please try again.' }
    }

    fileUrl = admin.storage.from('work-samples').getPublicUrl(path).data.publicUrl
  }

  const sample = await prisma.workSample.create({
    data: {
      candidateId: profile.id,
      title,
      description,
      sampleType,
      problemStatement: (formData.get('problemStatement') as string | null) || null,
      candidateRole: (formData.get('candidateRole') as string | null) || null,
      outcome: (formData.get('outcome') as string | null) || null,
      fileUrl,
      externalUrl,
    },
  })

  captureServerEvent(profile.id, 'work_sample_added', { sampleId: sample.id, sampleType })

  try {
    await applyWorkSampleUploadedRewrite(profile.id)
  } catch (error) {
    console.error('Failed to apply work-sample baseline rewrite:', error)
  }

  revalidatePath('/dashboard/work-samples')
  revalidatePath('/dashboard')
}

export async function deleteWorkSample(sampleId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)

  await prisma.workSample.deleteMany({
    where: { id: sampleId, candidateId: profile.id },
  })

  captureServerEvent(profile.id, 'work_sample_deleted', { sampleId })

  revalidatePath('/dashboard/work-samples')
  revalidatePath('/dashboard')
}
