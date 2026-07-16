'use server'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { sendResumeLeadConfirmationEmail } from '@/lib/email/send-resume-lead-confirmation'

export type ResumeLeadFormState = { error?: string; sent?: boolean } | undefined

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function submitResumeLead(
  _prevState: ResumeLeadFormState,
  formData: FormData
): Promise<ResumeLeadFormState> {
  const fullName = (formData.get('fullName') as string | null)?.trim()
  const email = (formData.get('email') as string | null)?.trim()
  const targetRole = (formData.get('targetRole') as string | null)?.trim() || null

  if (!fullName) {
    return { error: 'Enter your name.' }
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Enter a valid email.' }
  }

  const file = formData.get('file') as File | null
  let filePath: string | null = null
  let fileName: string | null = null

  if (file && file.size > 0) {
    if (file.size > MAX_FILE_SIZE) {
      return { error: 'File is too large — please upload a resume under 10MB.' }
    }
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'pdf' && ext !== 'docx') {
      return { error: 'Please upload a PDF or DOCX file.' }
    }

    const admin = createAdminClient()
    const path = `leads/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await admin.storage
      .from('resumes')
      .upload(path, file, { contentType: file.type || undefined })

    if (uploadError) {
      return { error: 'Something went wrong uploading your file. Please try again.' }
    }
    filePath = path
    fileName = file.name
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const candidateId = user ? (await getOrCreateCandidateProfile(user.id)).id : null

  await prisma.resumeSubmissionLead.create({
    data: { candidateId, fullName, email, targetRole, filePath, fileName, source: 'homepage' },
  })

  await sendResumeLeadConfirmationEmail(email, fullName)

  captureServerEvent(candidateId ?? email, 'resume_lead_submitted', { hasFile: !!filePath })

  return { sent: true }
}
