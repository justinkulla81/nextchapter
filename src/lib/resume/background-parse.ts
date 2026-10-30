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

const NOT_A_RESUME = "That doesn't look like a resume — please upload your actual resume (a PDF or Word document with your work history)."

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

    let rejected = false
    if (!resumeId) {
      stage = 'read_file'
      const { data: blob, error } = await createAdminClient().storage.from('resumes').download(state.path)
      if (error || !blob) throw new Error('stored file could not be read')
      const { text, error: extractionError } = await extractResumeText(new File([blob], state.fileName), state.fileType)

      // No readable text is rejected here without a model call (classifyResumeDocument answers that case itself).
      if (!text || text.trim().length < 40) {
        const empty = await classifyResumeDocument(text)
        const row = await prisma.resume.create({
          data: {
            candidateId: profileId, filePath: state.path, fileName: state.fileName, label: state.fileName, fileType: state.fileType,
            extractedText: text, extractionError, looksLikeResume: false, notAResumeReason: empty.reason,
          },
        })
        await updateParse(profileId, attempt, { status: 'rejected', resumeId: row.id, reason: empty.reason ?? NOT_A_RESUME })
        captureServerEvent(profileId, 'resume_parse_rejected', { reason: 'no_text', durationMs: Date.now() - started })
        return
      }
      const row = await prisma.resume.create({
        data: {
          candidateId: profileId, filePath: state.path, fileName: state.fileName, label: state.fileName, fileType: state.fileType,
          extractedText: text, extractionError, looksLikeResume: false, notAResumeReason: READING,
        },
      })
      resumeId = row.id
      await updateParse(profileId, attempt, { resumeId })
    }

    // The model call is the long pole, so the match baseline runs beside it (it must still be taken before the
    // profile is written: the gate below waits for it).
    stage = 'extract_profile'
    const baseline = captureMatchBaseline(profile)
    baseline.catch(() => {}) // surfaced where it is awaited below

    // Whether this is a résumé is read from the extraction itself: a reply with education or jobs in it is one, so
    // the separate classify call is gone from the normal path (it was the slowest and least predictable step).
    // Only a reply with neither goes to classifyResumeDocument, before anything is written.
    const rowId = resumeId
    const gate = async ({ hasEntries }: { hasEntries: boolean }) => {
      await baseline
      if (!hasEntries) {
        const row = await prisma.resume.findUniqueOrThrow({ where: { id: rowId }, select: { extractedText: true } })
        const classification = await classifyResumeDocument(row.extractedText)
        if (!classification.isResume) {
          const reason = classification.reason ?? NOT_A_RESUME
          // The row stays on record (admin can see what was submitted); nothing is written to the profile.
          await prisma.resume.update({ where: { id: rowId }, data: { notAResumeReason: reason } })
          await updateParse(profileId, attempt, { status: 'rejected', reason })
          captureServerEvent(profileId, 'resume_parse_rejected', { reason: 'not_a_resume', durationMs: Date.now() - started })
          rejected = true
          return false
        }
      }
      // Recorded only now that the file is known to be a résumé (an unconfirmed default must not be overwritten by a rejected upload).
      await prisma.candidateProfile.update({
        where: { id: profileId },
        data: { resumeBookOptIn: state.includeInResumeBook, resumeBookOptInConfirmedAt: new Date() },
      })
      if (state.includeInResumeBook !== profile.resumeBookOptIn) {
        captureServerEvent(profileId, state.includeInResumeBook ? 'resume_book_opt_in' : 'resume_book_opt_out', { source: 'resume_upload' })
      }
      return true
    }

    // The member moves on as soon as the profile fields are written; education, work history, flags and level rank
    // finish behind that, and the analysis starts after them.
    let handedOn = false
    const handOn = async () => {
      // A résumé with no name or email would create an account with blank fields (see uploadResume).
      if (!profile.registrationCompletedAt) {
        const now = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: profileId }, select: { firstName: true, lastName: true, email: true } })
        if (!now.firstName || !now.lastName || !now.email) {
          await prisma.resume.update({ where: { id: rowId }, data: { notAResumeReason: NO_CONTACT_REASON } })
          await updateParse(profileId, attempt, { status: 'rejected', reason: NO_CONTACT_REASON })
          captureServerEvent(profileId, 'resume_parse_rejected', { reason: 'no_contact_info', durationMs: Date.now() - started })
          return
        }
      }
      // Done for the member: from here the résumé counts everywhere and the progress screen hands over.
      await prisma.resume.update({ where: { id: rowId }, data: { looksLikeResume: true, notAResumeReason: null } })
      await clearParse(profileId, attempt)
      handedOn = true
      captureServerEvent(profileId, 'resume_parse_completed', { resumeId: rowId, durationMs: Date.now() - started })
    }
    const filled = await extractProfileFieldsFromResume(resumeId, {
      beforeWrite: gate,
      onProfileWritten: handOn,
    })
    if (rejected) return
    if (!handedOn) {
      // Nothing was written, or the member was turned down for missing contact details (already recorded above).
      if (!filled) throw new Error('profile fields could not be read from the résumé')
      return
    }
    // After the handover a failure in the slower sync no longer concerns the member; it is logged by the extraction.

    stage = 'post_analysis'
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
