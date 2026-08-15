'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import type { EngagementType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { ensureUser } from '@/lib/auth/ensure-user'
import { extractResumeText } from '@/lib/resume/extract-text'
import { analyzeResume } from '@/lib/resume/analyze-resume'
import { extractProfileFieldsFromResume } from '@/lib/resume/extract-profile-fields'
import { captureServerEvent } from '@/lib/posthog/server'
import { checkAndDeleteDuplicateProfile } from '@/lib/onboarding/duplicate-check'
import { applyWorkHistoryDuringGapRewrite, applyResumeImprovedRewrite } from '@/lib/scoring/rewrite-actions'
import { computeStructuralFlags } from '@/lib/resume/compute-structural-flags'
import { recomputeCandidateLevelRank } from '@/lib/scoring/level-rank-service'
import { maybeNotifyAdminOfNewCandidate } from '@/lib/email/send-admin-new-candidate-account'
import { computeResumeAnalysis } from '@/lib/scoring/resume-analysis/compute'
import { computeMarketRealityComponents } from '@/lib/scoring/market-reality/compute'
import { computeMarketRealityCompositeGrade } from '@/lib/scoring/market-reality/composite'

export type FormState =
  | { error?: string; existingAccountFound?: boolean; existingAccountEmail?: string; existingAccountNeedsPassword?: boolean }
  | undefined

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

  const cookieStore = await cookies()
  const coachId = cookieStore.get('nc_coach')?.value
  const profile = await getOrCreateCandidateProfile(user.id, { coachId })

  const admin = createAdminClient()
  const path = `${profile.id}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await admin.storage
    .from('resumes')
    .upload(path, file, { contentType: file.type || undefined })

  if (uploadError) {
    return { error: 'Something went wrong uploading your file. Please try again.' }
  }

  const { text, error: extractionError } = await extractResumeText(file, fileType)

  // Captured before creating the new row — the baseline to compare the
  // freshly analyzed resume against for the rewrite-action below.
  const previousResume = await prisma.resume.findFirst({
    where: { candidateId: profile.id },
    orderBy: { uploadedAt: 'desc' },
    select: { atsScore: true, resultsScore: true, experienceScore: true },
  })

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

  // Independent calls (analyzeResume writes Resume score/feedback fields,
  // extractProfileFieldsFromResume writes CandidateProfile fields, and
  // computeResumeAnalysis writes the new ResumeAnalysis/ReviewerQuestion/
  // AtsParseResult rows — none reads another's output) that used to run
  // back-to-back, meaning extractProfileFieldsFromResume's full latency was
  // pure added wait on top of analyzeResume's slower Sonnet call for no
  // reason.
  //
  // §11 decision (additive, not destructive): computeResumeAnalysis (the
  // new 5-component engine's Experience/Resume scorer, resume-analysis/
  // compute.ts) now runs on every upload alongside the LEGACY analyzeResume
  // — it is NOT run instead of it. The legacy Resume.atsScore/atsFeedback/
  // resultsScore/resultsFeedback/experienceScore/experienceFeedback fields
  // still have real, live, unmigrated consumers this change deliberately
  // does not touch: src/app/dashboard/resume/page.tsx (renders them
  // directly), src/app/onboarding/score/page.tsx (score-reveal, by its own
  // explicit design comment), src/lib/admin/recruiter-database.ts,
  // src/lib/scoring/rewrite-actions.ts's applyResumeImprovedRewrite (called
  // a few lines below), and src/lib/scoring/dossier-competencies.ts (the
  // six-category blended grade, ~23 other live consumers this session has
  // chosen not to touch). Retiring the legacy path is a separate, larger
  // migration across all of those call sites — out of scope here.
  const [, , resumeAnalysisResult] = await Promise.all([
    analyzeResume(resume.id),
    extractProfileFieldsFromResume(resume.id),
    // Unlike analyzeResume (which catches its own errors and writes
    // analysisError instead of throwing — see that file), computeResumeAnalysis
    // has no such internal guard yet, and this Promise.all has no outer
    // try/catch — an uncaught rejection here would fail the whole upload
    // action even though the file itself uploaded fine. Caught locally so a
    // new-engine failure degrades to "no ResumeAnalysis row yet" rather than
    // breaking the upload response.
    computeResumeAnalysis(resume.id).catch((error) => {
      console.error('Failed to compute new-engine resume analysis:', error)
      return null
    }),
  ])
  captureServerEvent(profile.id, 'resume_analyzed')

  // Refresh the live Market Reality Grade composite (MarketRealityComponentScore)
  // right after a new ResumeAnalysis exists — Experience/Resume are read
  // from the latest ResumeAnalysis row (see market-reality/compute.ts), so
  // this is the natural trigger point. Evidence/Effort/Market are also
  // recomputed here rather than left stale, since they're cheap, non-LLM
  // computations (DB counts + a cached market lookup) — not because a
  // resume upload logically changes them. Non-fatal: never blocks the
  // upload response, matching every other best-effort post-upload step in
  // this action.
  if (resumeAnalysisResult) {
    try {
      await computeMarketRealityComponents(profile.id)
      await computeMarketRealityCompositeGrade(profile.id)
    } catch (error) {
      console.error('Failed to refresh Market Reality Grade composite after resume upload:', error)
    }
  }

  // Extraction above is what typically first learns the candidate's real
  // name/email — this is the main trigger point for the single admin
  // new-candidate notification (no-ops until both are actually known).
  maybeNotifyAdminOfNewCandidate(profile.id).catch(() => {})

  try {
    const analyzed = await prisma.resume.findUnique({
      where: { id: resume.id },
      select: { atsScore: true, resultsScore: true, experienceScore: true },
    })
    if (analyzed) {
      await applyResumeImprovedRewrite(profile.id, previousResume, analyzed)
    }
  } catch (error) {
    console.error('Failed to apply resume-improved baseline rewrite:', error)
  }

  // Mid-onboarding (still an anonymous session) — if the resume's extracted
  // email already belongs to a real, registered account, delete this
  // just-created anonymous profile and send them to log in instead of
  // leaving a second profile/assessment behind for the same person (the
  // exact class of duplicate-account bug seen once already).
  if (user.is_anonymous) {
    const updated = await prisma.candidateProfile.findUnique({
      where: { id: profile.id },
      select: { email: true },
    })
    if (updated?.email) {
      const existingAccount = await checkAndDeleteDuplicateProfile(profile.id, updated.email)
      if (existingAccount) {
        return existingAccount.passwordSetAt
          ? { existingAccountFound: true }
          : { existingAccountNeedsPassword: true, existingAccountEmail: updated.email }
      }
    }
  }

  revalidatePath('/dashboard/resume')
  revalidatePath('/dashboard')
  revalidatePath('/onboarding/resume')
}

// §12 activation item 1, "Fix three things on your resume" — marks one
// Resume.atsFeedback/resultsFeedback/experienceFeedback item's `issue`
// string as addressed. Dedupe by string equality (no synthetic per-item id
// system — see resumeFixesAppliedKeys's own comment in schema.prisma).
// Idempotent: marking the same issueKey twice is a no-op past the first
// call, so the PostHog event only fires once per key. Returns void, not a
// FormState — bound and used directly as a <form action>, same shape as
// deleteWorkHistoryEntry/setPrimaryEngagement above, not routed through
// useActionState, so there's no error string to surface in the UI.
export async function markResumeFixApplied(issueKey: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  if (!profile.resumeFixesAppliedKeys.includes(issueKey)) {
    await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: { resumeFixesAppliedKeys: { push: issueKey } },
    })
    captureServerEvent(profile.id, 'resume_fix_marked_applied', { candidateId: profile.id, issueKey })
  }

  revalidatePath('/dashboard/resume')
  revalidatePath('/dashboard')
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

const ENGAGEMENT_TYPES: EngagementType[] = ['FULL_TIME', 'FRACTIONAL', 'INTERIM', 'CONSULTING', 'INTERNSHIP']

export type WorkHistoryFormState = { error?: string; victoriaNudge?: string } | undefined

export async function addWorkHistoryEntry(
  _prevState: WorkHistoryFormState,
  formData: FormData
): Promise<WorkHistoryFormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to do this.' }

  const companyName = (formData.get('companyName') as string | null)?.trim()
  const roleTitle = (formData.get('roleTitle') as string | null)?.trim()
  const startDateRaw = formData.get('startDate') as string | null
  const endDateRaw = (formData.get('endDate') as string | null)?.trim()
  const isCurrent = formData.get('isCurrent') === 'on'
  const engagementType = (formData.get('engagementType') as EngagementType | null) ?? 'FULL_TIME'
  const keyAchievement = (formData.get('keyAchievement') as string | null)?.trim() || null

  if (!companyName || !roleTitle || !startDateRaw) {
    return { error: 'Please fill in company, role, and start date.' }
  }
  if (!ENGAGEMENT_TYPES.includes(engagementType)) {
    return { error: 'Please choose a valid engagement type.' }
  }

  const startDate = new Date(startDateRaw)
  if (Number.isNaN(startDate.getTime())) return { error: 'Please enter a valid start date.' }

  const endDate = !isCurrent && endDateRaw ? new Date(endDateRaw) : null
  if (endDateRaw && endDate && Number.isNaN(endDate.getTime())) {
    return { error: 'Please enter a valid end date.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)

  await prisma.workHistoryEntry.create({
    data: {
      candidateId: profile.id,
      companyName,
      roleTitle,
      startDate,
      endDate,
      isCurrent,
      engagementType,
      keyAchievement,
    },
  })

  revalidatePath('/dashboard/resume')
  revalidatePath('/dashboard/privacy')

  try {
    await applyWorkHistoryDuringGapRewrite(profile.id, engagementType)
  } catch (error) {
    console.error('Failed to apply work-history baseline rewrite:', error)
  }

  try {
    await computeStructuralFlags(profile.id)
  } catch (error) {
    console.error('Failed to recompute structural flags after work-history add:', error)
  }

  try {
    await recomputeCandidateLevelRank(profile.id)
  } catch (error) {
    console.error('Failed to recompute level rank after work-history add:', error)
  }

  if (engagementType !== 'FULL_TIME') {
    return {
      victoriaNudge:
        "This is worth adding to your resume now — it closes the gap and keeps your story credible. Add just this one for now if you're doing more than one at once.",
    }
  }
}

export async function deleteWorkHistoryEntry(entryId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)

  await prisma.workHistoryEntry.deleteMany({
    where: { id: entryId, candidateId: profile.id },
  })

  revalidatePath('/dashboard/resume')

  try {
    await computeStructuralFlags(profile.id)
  } catch (error) {
    console.error('Failed to recompute structural flags after work-history delete:', error)
  }

  try {
    await recomputeCandidateLevelRank(profile.id)
  } catch (error) {
    console.error('Failed to recompute level rank after work-history delete:', error)
  }
}

// When a candidate has more than one concurrent fractional/interim/consulting
// engagement, external-facing views (Certified Executive Dossier, What They See) show
// only one at a time — see selectDisplayedWorkHistory(). This is how the
// candidate picks which one that is.
export async function setPrimaryEngagement(entryId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  const entry = await prisma.workHistoryEntry.findFirst({
    where: { id: entryId, candidateId: profile.id },
  })
  if (!entry) return

  await prisma.$transaction([
    prisma.workHistoryEntry.updateMany({
      where: { candidateId: profile.id, engagementType: { not: 'FULL_TIME' } },
      data: { isPrimaryEngagement: false },
    }),
    prisma.workHistoryEntry.update({
      where: { id: entryId },
      data: { isPrimaryEngagement: true },
    }),
  ])

  revalidatePath('/dashboard/resume')

  try {
    await recomputeCandidateLevelRank(profile.id)
  } catch (error) {
    console.error('Failed to recompute level rank after primary-engagement change:', error)
  }
}
