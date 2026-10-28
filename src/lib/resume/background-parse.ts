import 'server-only'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractResumeText } from '@/lib/resume/extract-text'
import { classifyResumeDocument } from '@/lib/resume/classify-resume'
import { extractProfileFieldsFromResume } from '@/lib/resume/extract-profile-fields'
import { runPostUploadAnalysis } from '@/lib/resume/post-upload-analysis'
import { captureMatchBaseline } from '@/lib/personalization/match-snapshot'
import { captureServerEvent } from '@/lib/posthog/server'
import { readParseState, updateParse, clearParse } from '@/lib/resume/parse-state'

const NO_CONTACT_REASON =
  "We couldn't find your name and email address on this resume — please upload a version with your contact information at the top."

// While a résumé is still being read its Resume row (if it exists yet) is marked like this, so every
// "has a résumé" check (looksLikeResume not false) stays false until the profile is filled in.
const READING = 'Still being read'

/**
 * The work the onboarding upload used to do before answering: read the file, check it is a résumé, fill the
 * profile, then hand the rest to the analysis. Runs after the response (see startResumeUpload) and again on Retry.
 * The same steps and the same model calls as before, so the cost per résumé is unchanged; a retry after a
 * failure skips the steps already done.
 */
export async function runResumeParse(profileId: string, attempt: string): Promise<void> {
  const started = Date.now()
  let stage = 'start'
  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { id: profileId } })
    const state = readParseState(profile?.journeyDetails)
    if (!profile || !state || state.attempt !== attempt) return

    let resumeId = state.resumeId
    const previousResume = await prisma.resume.findFirst({
      where: { candidateId: profileId, looksLikeResume: { not: false } },
      orderBy: { uploadedAt: 'desc' },
      select: { atsScore: true, resultsScore: true, experienceScore: true },
    })

    if (!resumeId) {
      stage = 'read_file'
      const { data: blob, error } = await createAdminClient().storage.from('resumes').download(state.path)
      if (error || !blob) throw new Error('stored file could not be read')
      const { text, error: extractionError } = await extractResumeText(new File([blob], state.fileName), state.fileType)

      stage = 'classify'
      const classification = await classifyResumeDocument(text)
      const row = await prisma.resume.create({
        data: {
          candidateId: profileId,
          filePath: state.path,
          fileName: state.fileName,
          label: state.fileName,
          fileType: state.fileType,
          extractedText: text,
          extractionError,
          looksLikeResume: false,
          notAResumeReason: classification.isResume ? READING : classification.reason,
        },
      })
      if (!classification.isResume) {
        // The row stays on record (admin can see what was submitted); nothing downstream runs on it.
        await updateParse(profileId, attempt, {
          status: 'rejected',
          resumeId: row.id,
          reason: classification.reason ?? "That doesn't look like a resume — please upload your actual resume (a PDF or Word document with your work history).",
        })
        captureServerEvent(profileId, 'resume_parse_rejected', { reason: 'not_a_resume', durationMs: Date.now() - started })
        return
      }
      resumeId = row.id
      await updateParse(profileId, attempt, { resumeId })
    }

    // Recorded only now that the file is known to be a résumé (an unconfirmed default must not be overwritten by a rejected upload).
    stage = 'extract_profile'
    await prisma.candidateProfile.update({
      where: { id: profileId },
      data: { resumeBookOptIn: state.includeInResumeBook, resumeBookOptInConfirmedAt: new Date() },
    })
    if (state.includeInResumeBook !== profile.resumeBookOptIn) {
      captureServerEvent(profileId, state.includeInResumeBook ? 'resume_book_opt_in' : 'resume_book_opt_out', { source: 'resume_upload' })
    }
    await captureMatchBaseline(profile)
    const filled = await extractProfileFieldsFromResume(resumeId)
    if (!filled) throw new Error('profile fields could not be read from the résumé')

    // A résumé with no name or email would create an account with blank fields (see uploadResume).
    if (!profile.registrationCompletedAt) {
      const now = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: profileId }, select: { firstName: true, lastName: true, email: true } })
      if (!now.firstName || !now.lastName || !now.email) {
        await prisma.resume.update({ where: { id: resumeId }, data: { notAResumeReason: NO_CONTACT_REASON } })
        await updateParse(profileId, attempt, { status: 'rejected', reason: NO_CONTACT_REASON })
        captureServerEvent(profileId, 'resume_parse_rejected', { reason: 'no_contact_info', durationMs: Date.now() - started })
        return
      }
    }

    // Done: from here the résumé counts everywhere and the progress screen hands over to the next step.
    stage = 'finish'
    await prisma.resume.update({ where: { id: resumeId }, data: { looksLikeResume: true, notAResumeReason: null } })
    await clearParse(profileId, attempt)
    captureServerEvent(profileId, 'resume_parse_completed', { resumeId, durationMs: Date.now() - started })

    await runPostUploadAnalysis(profileId, resumeId, previousResume).catch((error) => {
      console.error('Post-upload résumé analysis failed:', error)
    })
  } catch (error) {
    console.error(`Résumé parse failed at ${stage}:`, error)
    await updateParse(profileId, attempt, { status: 'failed' }).catch(() => {})
    captureServerEvent(profileId, 'resume_parse_failed', {
      stage,
      durationMs: Date.now() - started,
      message: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
    })
  }
}
