'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { ensureUser } from '@/lib/auth/ensure-user'
import { extractResumeText } from '@/lib/resume/extract-text'
import { analyzeResume } from '@/lib/resume/analyze-resume'
import { extractProfileFieldsFromResume } from '@/lib/resume/extract-profile-fields'
import { recalculateScore } from '@/lib/scoring/recalculate'

export type FormState = { error?: string } | undefined

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function uploadResume(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient()

  let user
  try {
    user = await ensureUser(supabase)
  } catch {
    return { error: 'Something went wrong starting your session. Please try again.' }
  }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) {
    return { error: 'Please choose a resume file to upload.' }
  }

  if (file.size > MAX_FILE_SIZE) {
    return { error: 'File is too large — please upload a resume under 10MB.' }
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext !== 'pdf' && ext !== 'docx') {
    return { error: 'Please upload a PDF or DOCX file.' }
  }
  const fileType = ext

  const profile = await getOrCreateCandidateProfile(user.id)

  const admin = createAdminClient()
  const path = `${profile.id}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await admin.storage
    .from('resumes')
    .upload(path, file, { contentType: file.type || undefined })

  if (uploadError) {
    return { error: 'Something went wrong uploading your file. Please try again.' }
  }

  const { text, error: extractionError } = await extractResumeText(file, fileType)

  const resume = await prisma.resume.create({
    data: {
      candidateId: profile.id,
      filePath: path,
      fileName: file.name,
      fileType,
      extractedText: text,
      extractionError,
    },
  })

  await analyzeResume(resume.id)
  await extractProfileFieldsFromResume(resume.id)

  revalidatePath('/dashboard/resume')
  revalidatePath('/dashboard')
  revalidatePath('/onboarding/resume')
}

export async function setLinkedInUrl(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient()

  let user
  try {
    user = await ensureUser(supabase)
  } catch {
    return { error: 'Something went wrong starting your session. Please try again.' }
  }

  const linkedInUrl = (formData.get('linkedInUrl') as string | null)?.trim()
  if (!linkedInUrl) {
    return { error: 'Please enter your LinkedIn profile URL.' }
  }

  try {
    new URL(linkedInUrl)
  } catch {
    return { error: 'Please enter a valid URL.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { linkedInUrl },
  })
  await recalculateScore(profile.id, 'linkedin_url_added')

  revalidatePath('/dashboard/resume')
  revalidatePath('/dashboard')
}

export async function getResumeSignedUrl(resumeId: string): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const profile = await getOrCreateCandidateProfile(user.id)
  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, candidateId: profile.id },
  })
  if (!resume) return null

  const admin = createAdminClient()
  const { data } = await admin.storage.from('resumes').createSignedUrl(resume.filePath, 60 * 10)
  return data?.signedUrl ?? null
}
