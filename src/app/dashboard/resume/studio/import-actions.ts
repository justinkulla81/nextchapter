'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { importDocumentFromText } from '@/lib/resume/studio/import'
import type { StudioActionState } from '@/app/dashboard/resume/studio/actions'

const MAX_DRAFTS = 20
// Anything shorter than this is not a resume the import can usefully read.
const MIN_TEXT_CHARS = 200

// Reads an uploaded resume into the studio, exactly as written, as the Original. The upload is the source of
// truth: the text the file was read from is copied into a document, then checked word for word against that text.
// What the check could not place is saved with the draft and shown, never silently dropped.
export async function importFromUpload(_prev: StudioActionState, formData: FormData): Promise<StudioActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const profile = user ? await getOrCreateCandidateProfile(user.id) : null
  if (!profile) return { error: 'You need to be logged in to do this. Sign in and try again.' }

  const resumeId = String(formData.get('resumeId') ?? '')
  const resume = await prisma.resume.findFirst({
    where: { candidateId: profile.id, looksLikeResume: { not: false }, ...(resumeId ? { id: resumeId } : {}) },
    orderBy: { uploadedAt: 'desc' },
    select: { id: true, fileName: true, label: true, extractedText: true },
  })
  if (!resume) return { error: 'We could not find an uploaded resume. Upload one first, then try again.' }

  // Importing the same file twice opens the Original that is already there instead of making a second one.
  const existing = await prisma.resumeDraft.findFirst({ where: { candidateId: profile.id, sourceResumeId: resume.id, kind: 'ORIGINAL' }, select: { id: true } })
  if (existing && formData.get('again') !== '1') redirect(`/dashboard/resume/studio/${existing.id}`)

  const text = resume.extractedText?.trim() ?? ''
  if (text.length < MIN_TEXT_CHARS) {
    return { error: 'We could not read the text in that file. If it is a scan or a picture of a resume, upload a PDF or Word version with selectable text, or start from your profile.' }
  }
  const count = await prisma.resumeDraft.count({ where: { candidateId: profile.id } })
  if (count >= MAX_DRAFTS) return { error: `You have ${MAX_DRAFTS} drafts, the most we keep. Delete one you no longer need, then try again.` }

  const started = Date.now()
  let result
  try {
    result = await importDocumentFromText(text)
  } catch (err) {
    captureServerEvent(profile.id, 'resume_import_failed', { candidateId: profile.id, resumeId: resume.id, error: err instanceof Error ? err.message.slice(0, 200) : 'unknown' })
    return { error: 'We could not read that resume just now. Nothing was changed. Try again in a minute.' }
  }

  const label = (resume.label || resume.fileName).slice(0, 80)
  const draft = await prisma.resumeDraft.create({
    data: {
      candidateId: profile.id,
      name: `Original — ${label}`.slice(0, 100),
      // Matches how most uploaded resumes are laid out; the person can switch templates in the editor.
      templateId: 'executive',
      kind: 'ORIGINAL',
      sourceResumeId: resume.id,
      document: result.document as unknown as Prisma.InputJsonValue,
      importReport: {
        ok: result.report.ok,
        coverage: Number(result.report.coverage.toFixed(4)),
        missing: result.report.missing.slice(0, 40),
        added: result.report.added.slice(0, 40),
        unplacedLines: result.report.unplacedLines.slice(0, 20),
        attempts: result.attempts,
      } as unknown as Prisma.InputJsonValue,
    },
  })
  captureServerEvent(profile.id, 'resume_import_completed', {
    candidateId: profile.id,
    draftId: draft.id,
    resumeId: resume.id,
    exact: result.report.ok,
    coverage: Number(result.report.coverage.toFixed(3)),
    missingCount: result.report.missing.length,
    addedCount: result.report.added.length,
    attempts: result.attempts,
    ms: Date.now() - started,
  })
  revalidatePath('/dashboard/resume/studio')
  redirect(`/dashboard/resume/studio/${draft.id}`)
}
