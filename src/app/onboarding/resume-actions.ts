'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureUser } from '@/lib/auth/ensure-user'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { runResumeParse } from '@/lib/resume/background-parse'
import { claimParse, clearParse, readParseState } from '@/lib/resume/parse-state'
import { PARSE_STALE_MS, type ResumeParseState } from '@/lib/resume/parse-view'

export type StartUploadState = { error?: string } | undefined

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB, same as the dashboard upload

// The onboarding résumé upload. It stores the file, notes that reading it is under way and answers; reading the
// file, checking it is a résumé and filling the profile happen afterwards (runResumeParse), while the member
// watches the progress screen. Before this the member waited on the model calls inside the upload itself.
export async function startResumeUpload(_prev: StartUploadState, formData: FormData): Promise<StartUploadState> {
  const t0 = Date.now()
  const supabase = await createClient()
  let user
  try {
    user = await ensureUser(supabase)
  } catch {
    return { error: 'Something went wrong starting your session. Please try again.' }
  }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Please choose a resume file to upload.' }
  if (file.size > MAX_FILE_SIZE) return { error: 'File is too large — please upload a resume under 10MB.' }
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext !== 'pdf' && ext !== 'docx') return { error: 'Please upload a PDF or DOCX file.' }

  const coachId = (await cookies()).get('nc_coach')?.value
  const profile = await getOrCreateCandidateProfile(user.id, { coachId })

  // A reading already under way (a double click, a second tab): leave it be rather than start another.
  const current = readParseState(profile.journeyDetails)
  if (current?.status === 'processing' && Date.now() - new Date(current.startedAt).getTime() < PARSE_STALE_MS) {
    revalidatePath('/onboarding/resume')
    return
  }

  const path = `${profile.id}/${crypto.randomUUID()}.${ext}`
  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage.from('resumes').upload(path, file, { contentType: file.type || undefined })
  if (uploadError) return { error: 'Something went wrong uploading your file. Please try again.' }

  const state: ResumeParseState = {
    attempt: crypto.randomUUID(),
    status: 'processing',
    startedAt: new Date().toISOString(),
    path,
    fileName: file.name,
    fileType: ext,
    includeInResumeBook: formData.get('includeInResumeBook') === 'on',
  }
  if (!(await claimParse(profile.id, state))) {
    // Lost the race to another upload from the same member: its file stays, this one is dropped.
    await admin.storage.from('resumes').remove([path])
    revalidatePath('/onboarding/resume')
    return
  }

  captureServerEvent(profile.id, 'resume_upload_accepted', { fileType: ext, sizeKb: Math.round(file.size / 1024), durationMs: Date.now() - t0 })
  after(() => runResumeParse(profile.id, state.attempt))
  revalidatePath('/onboarding/resume')
}

async function currentProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

// Retry after a failed (or stalled) reading: the stored file is read again, without a new upload.
export async function retryResumeParse(): Promise<void> {
  const profile = await currentProfile()
  const state = profile && readParseState(profile.journeyDetails)
  if (!profile || !state) return
  const next: ResumeParseState = { ...state, attempt: crypto.randomUUID(), status: 'processing', startedAt: new Date().toISOString() }
  if (await claimParse(profile.id, next)) {
    captureServerEvent(profile.id, 'resume_parse_retried', {})
    after(() => runResumeParse(profile.id, next.attempt))
  }
  revalidatePath('/onboarding/resume')
}

// "Upload a different file": drops the failed or rejected reading so the upload form comes back.
export async function discardResumeParse(): Promise<void> {
  const profile = await currentProfile()
  if (!profile) return
  const state = readParseState(profile.journeyDetails)
  // A reading still within its time is left alone; only an ended or stalled one can be dropped.
  if (state?.status === 'processing' && Date.now() - new Date(state.startedAt).getTime() < PARSE_STALE_MS) return
  await clearParse(profile.id)
  // The unfinished Resume row of a failed reading is removed so it cannot linger as a half-read version.
  if (state?.resumeId) await prisma.resume.deleteMany({ where: { id: state.resumeId, candidateId: profile.id, looksLikeResume: false } })
  revalidatePath('/onboarding/resume')
}
