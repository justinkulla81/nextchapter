'use server'

import { randomBytes } from 'node:crypto'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureUser } from '@/lib/auth/ensure-user'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { allowByIp, allowByTarget, DAY_MS, HOUR_MS, RATE_LIMITED_MESSAGE } from '@/lib/security/rate-limit'
import { validateUpload } from '@/lib/uploads/validate-upload'
import { validateApplication } from '@/lib/careers/application'
import { readResumeContact } from '@/lib/careers/resume-contact-server'
import { MIN_RESUME_TEXT_LENGTH, UNREADABLE_RESUME_MESSAGE, missingContactMessage } from '@/lib/careers/resume-contact'
import { extractResumeText } from '@/lib/resume/extract-text'
import { sendCareerApplicationEmail } from '@/lib/email/send-career-application'
import { uploadResume } from '@/app/dashboard/resume/actions'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const OFFER_WINDOW_MS = 24 * 60 * 60 * 1000

export type ApplyState =
  | {
      error?: string
      submitted?: { applicationId: string; claimToken: string; firstName: string; canRegister: boolean }
    }
  | undefined

export async function submitCareerApplication(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  const checked = validateApplication({
    roleSlug: String(formData.get('roleSlug') ?? ''),
    note: String(formData.get('note') ?? ''),
  })
  if ('error' in checked) return { error: checked.error }
  const app = checked.ok

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Choose your resume to upload.' }
  if (file.size > MAX_FILE_SIZE) return { error: 'That file is too large. Upload a resume under 10MB.' }

  // Before anything is read or stored: each call can write up to 10 MB to storage and sends an email.
  if (!(await allowByIp('careers-apply', 10, HOUR_MS))) return { error: RATE_LIMITED_MESSAGE }

  const check = await validateUpload(file, 'resume', MAX_FILE_SIZE)
  if (!check.ok) return { error: check.error }

  // The name and email come from the resume, not the form. A resume that shows neither is not accepted.
  const { text } = await extractResumeText(file, check.ext === 'pdf' ? 'pdf' : 'docx')
  if (!text || text.trim().length < MIN_RESUME_TEXT_LENGTH) return { error: UNREADABLE_RESUME_MESSAGE }
  const contact = await readResumeContact(text)
  const missing = missingContactMessage(contact)
  if (missing) return { error: missing }
  const fullName = contact.name as string
  const email = contact.email as string

  if (!(await allowByTarget('careers-apply-email', email, 3, DAY_MS))) {
    return { error: 'We already have a few applications from that address today. Please try again tomorrow.' }
  }

  const path = `careers/${crypto.randomUUID()}.${check.ext}`
  const { error: uploadError } = await createAdminClient()
    .storage.from('resumes')
    .upload(path, file, { contentType: check.contentType })
  if (uploadError) return { error: 'Something went wrong uploading your file. Please try again.' }

  const claimToken = randomBytes(24).toString('hex')
  const row = await prisma.careerApplication.create({
    data: {
      fullName,
      email,
      roleSlug: app.roleSlug,
      roleTitle: app.roleTitle,
      note: app.note,
      filePath: path,
      fileName: file.name,
      claimToken,
    },
    select: { id: true },
  })

  // Someone already signed in as a member has nothing to register for.
  const {
    data: { user },
  } = await (await createClient()).auth.getUser()
  const canRegister = !user || user.is_anonymous === true

  const fileBytes = Buffer.from(await file.arrayBuffer())
  after(async () => {
    await sendCareerApplicationEmail({
      fullName,
      email,
      roleTitle: app.roleTitle,
      note: app.note,
      fileName: file.name,
      file: fileBytes,
    })
  })

  captureServerEvent(email, 'career_application_submitted', {
    applicationId: row.id,
    roleSlug: app.roleSlug,
    roleTitle: app.roleTitle,
    hasNote: !!app.note,
    canRegister,
  })

  return { submitted: { applicationId: row.id, claimToken, firstName: fullName.split(' ')[0], canRegister } }
}

export type RegisterState =
  | { error?: string; existingAccountFound?: boolean; existingAccountNeedsPassword?: boolean; existingAccountEmail?: string }
  | undefined

/**
 * "Yes, register me": starts the onboarding funnel with the resume the person just sent, so it is never asked for
 * again. Runs the same resume pipeline as the funnel's own upload (reading it, filling the profile, the duplicate-account
 * check), then sends the person on to the next step. Resume Book visibility is left off.
 */
export async function registerFromApplication(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const id = String(formData.get('applicationId') ?? '')
  const token = String(formData.get('claimToken') ?? '')
  if (!id || !token) return { error: 'This offer is no longer available. You can register from the home page.' }

  // One-time and time-limited, and only for the browser that holds the token.
  const claimed = await prisma.careerApplication.updateMany({
    where: { id, claimToken: token, registrationStartedAt: null, createdAt: { gte: new Date(Date.now() - OFFER_WINDOW_MS) } },
    data: { registrationStartedAt: new Date() },
  })
  if (claimed.count !== 1) return { error: 'This offer is no longer available. You can register from the home page.' }

  const release = () => prisma.careerApplication.update({ where: { id }, data: { registrationStartedAt: null } }).catch(() => {})
  const app = await prisma.careerApplication.findUniqueOrThrow({ where: { id } })

  const { data: blob, error: downloadError } = await createAdminClient().storage.from('resumes').download(app.filePath)
  if (downloadError || !blob) {
    await release()
    return { error: 'We could not set up your account just now. Please try again.' }
  }
  const type = app.filePath.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  const file = new File([blob], app.fileName, { type })

  // Start the session and profile first, with the email from the application, so the resume reader has it even if
  // the resume itself shows none.
  let profileId: string
  try {
    const user = await ensureUser(await createClient())
    const coachId = (await cookies()).get('nc_coach')?.value
    const profile = await getOrCreateCandidateProfile(user.id, { coachId })
    profileId = profile.id
    if (!profile.registrationCompletedAt) {
      // Only the email is carried over; the name is read from the resume by the funnel's own reader.
      await prisma.candidateProfile.update({ where: { id: profile.id }, data: { email: profile.email || app.email } })
    }
  } catch {
    await release()
    return { error: 'We could not set up your account just now. Please try again.' }
  }

  const upload = new FormData()
  upload.set('file', file) // includeInResumeBook is not set: not shown to recruiters
  const result = await uploadResume(undefined, upload)
  if (result?.existingAccountFound || result?.existingAccountNeedsPassword) {
    return {
      existingAccountFound: result.existingAccountFound,
      existingAccountNeedsPassword: result.existingAccountNeedsPassword,
      existingAccountEmail: result.existingAccountEmail ?? app.email,
    }
  }
  if (result?.error) {
    await release()
    return { error: result.error }
  }

  await prisma.careerApplication.update({ where: { id }, data: { candidateId: profileId } })
  captureServerEvent(profileId, 'career_registration_started', { applicationId: id, roleSlug: app.roleSlug })
  redirect('/onboarding')
}
