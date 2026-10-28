'use server'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { cookies } from 'next/headers'
import { REFERRAL_COOKIE } from '@/lib/candidates/referral'
import { sendResumeLeadConfirmationEmail } from '@/lib/email/send-resume-lead-confirmation'
import { allowByIp, allowByTarget, DAY_MS, HOUR_MS, RATE_LIMITED_MESSAGE } from '@/lib/security/rate-limit'
import { validateUpload } from '@/lib/uploads/validate-upload'
import { notifyNewLead } from '@/lib/leads/notify-new-lead'

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

  // Before the upload: each call writes up to 10 MB to storage and emails
  // an arbitrary address.
  if (!(await allowByIp('submit-resume', 10, HOUR_MS))) return { error: RATE_LIMITED_MESSAGE }
  if (!(await allowByTarget('submit-resume-email', email, 3, DAY_MS))) {
    return { error: 'We already have a few submissions from that address today. Please try again tomorrow.' }
  }

  const file = formData.get('file') as File | null
  let filePath: string | null = null
  let fileName: string | null = null

  if (file && file.size > 0) {
    if (file.size > MAX_FILE_SIZE) {
      return { error: 'File is too large — please upload a resume under 10MB.' }
    }
    const check = await validateUpload(file, 'resume', MAX_FILE_SIZE)
    if (!check.ok) return { error: check.error }

    const admin = createAdminClient()
    const path = `leads/${crypto.randomUUID()}.${check.ext}`
    const { error: uploadError } = await admin.storage
      .from('resumes')
      .upload(path, file, { contentType: check.contentType })

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
  const profile = user ? await getOrCreateCandidateProfile(user.id) : null
  const candidateId = profile?.id ?? null

  // A recruiter's or contact's referral link (nc_ref cookie) credits the submission to them.
  const refCode = (await cookies()).get(REFERRAL_COOKIE)?.value
  const refLink = refCode ? await prisma.referralLink.findUnique({ where: { code: refCode }, select: { label: true, kind: true, isActive: true } }) : null
  const source = refLink?.isActive ? `referral:${refLink.kind}:${refLink.label}`.slice(0, 120) : 'homepage'

  await prisma.resumeSubmissionLead.create({
    data: { candidateId, fullName, email, targetRole, filePath, fileName, source },
  })
  notifyNewLead({ email, name: fullName, channel: 'Résumé submission', detail: source })

  await sendResumeLeadConfirmationEmail(email, fullName, profile?.confidentialSearchMode ?? false)

  captureServerEvent(candidateId ?? email, 'resume_lead_submitted', { hasFile: !!filePath, source })

  return { sent: true }
}
