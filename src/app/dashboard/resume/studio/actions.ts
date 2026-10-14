'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { buildResumeDocumentData } from '@/lib/resume/export/document-data'
import { RESUME_TEMPLATE_META } from '@/lib/resume/export/template-meta'
import { blankResumeDocument, parseResumeDocument } from '@/lib/resume/studio/document'
import { summarizeDocument } from '@/lib/resume/studio/writing-checks'

const MAX_DRAFTS = 20
const MAX_JOB_DESCRIPTION = 20_000

async function currentCandidate() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? getOrCreateCandidateProfile(user.id) : null
}

export type StudioActionState = { error?: string } | undefined

// Starts a draft from the candidate's profile (work history, education, skills) or blank.
export async function createDraft(_prev: StudioActionState, formData: FormData): Promise<StudioActionState> {
  const profile = await currentCandidate()
  if (!profile) return { error: 'You need to be logged in to do this. Sign in and try again.' }

  const count = await prisma.resumeDraft.count({ where: { candidateId: profile.id } })
  if (count >= MAX_DRAFTS) {
    return { error: `You have ${MAX_DRAFTS} drafts, the most we keep. Delete one you no longer need, then try again.` }
  }

  const fromProfile = formData.get('source') !== 'blank'
  const document = fromProfile ? await buildResumeDocumentData(profile.id) : blankResumeDocument()
  const name = String(formData.get('name') ?? '').trim().slice(0, 100) || (fromProfile ? 'Draft from my profile' : 'Blank draft')

  const draft = await prisma.resumeDraft.create({
    data: { candidateId: profile.id, name, document: document as unknown as Prisma.InputJsonValue },
  })
  captureServerEvent(profile.id, 'resume_draft_created', { candidateId: profile.id, draftId: draft.id, source: fromProfile ? 'profile' : 'blank' })
  redirect(`/dashboard/resume/studio/${draft.id}`)
}

export interface SaveDraftInput {
  name: string
  templateId: string
  document: unknown
  jobDescription: string
}
export type SaveDraftResult = { ok: true; savedAt: string } | { ok: false; error: string }

// Called by the editor's Save button. The document is re-validated here, never trusted from the browser.
export async function saveDraft(draftId: string, input: SaveDraftInput): Promise<SaveDraftResult> {
  const profile = await currentCandidate()
  if (!profile) return { ok: false, error: 'You need to be logged in to do this. Sign in and try again.' }

  const draft = await prisma.resumeDraft.findFirst({ where: { id: draftId, candidateId: profile.id }, select: { id: true } })
  if (!draft) return { ok: false, error: 'We could not find this draft. It may have been deleted. Go back to your drafts and open it again.' }

  const parsed = parseResumeDocument(input.document)
  if (!parsed.ok) return { ok: false, error: parsed.error }
  const name = input.name.trim().slice(0, 100)
  if (!name) return { ok: false, error: 'Give this draft a name so you can tell it apart from your others.' }
  const templateId = RESUME_TEMPLATE_META.some((t) => t.id === input.templateId) ? input.templateId : 'classic'

  const updated = await prisma.resumeDraft.update({
    where: { id: draft.id },
    data: {
      name,
      templateId,
      document: parsed.data as unknown as Prisma.InputJsonValue,
      jobDescription: input.jobDescription.trim().slice(0, MAX_JOB_DESCRIPTION) || null,
    },
    select: { updatedAt: true },
  })
  const summary = summarizeDocument(parsed.data)
  captureServerEvent(profile.id, 'resume_draft_saved', {
    candidateId: profile.id,
    draftId: draft.id,
    templateId,
    bullets: summary.bulletCount,
    quantifiedBullets: summary.quantifiedCount,
    hasJobDescription: input.jobDescription.trim().length > 0,
  })
  revalidatePath('/dashboard/resume/studio')
  return { ok: true, savedAt: updated.updatedAt.toISOString() }
}

export async function duplicateDraft(_prev: StudioActionState, formData: FormData): Promise<StudioActionState> {
  const profile = await currentCandidate()
  if (!profile) return { error: 'You need to be logged in to do this. Sign in and try again.' }
  const source = await prisma.resumeDraft.findFirst({ where: { id: String(formData.get('draftId') ?? ''), candidateId: profile.id } })
  if (!source) return { error: 'We could not find this draft. Reload the page and try again.' }
  const count = await prisma.resumeDraft.count({ where: { candidateId: profile.id } })
  if (count >= MAX_DRAFTS) return { error: `You have ${MAX_DRAFTS} drafts, the most we keep. Delete one you no longer need, then try again.` }

  const copy = await prisma.resumeDraft.create({
    data: {
      candidateId: profile.id,
      name: `${source.name} (copy)`.slice(0, 100),
      templateId: source.templateId,
      document: source.document as Prisma.InputJsonValue,
      jobDescription: source.jobDescription,
    },
  })
  captureServerEvent(profile.id, 'resume_draft_duplicated', { candidateId: profile.id, draftId: copy.id, fromDraftId: source.id })
  redirect(`/dashboard/resume/studio/${copy.id}`)
}

export async function deleteDraft(_prev: StudioActionState, formData: FormData): Promise<StudioActionState> {
  const profile = await currentCandidate()
  if (!profile) return { error: 'You need to be logged in to do this. Sign in and try again.' }
  const draftId = String(formData.get('draftId') ?? '')
  const result = await prisma.resumeDraft.deleteMany({ where: { id: draftId, candidateId: profile.id } })
  if (result.count > 0) captureServerEvent(profile.id, 'resume_draft_deleted', { candidateId: profile.id, draftId })
  revalidatePath('/dashboard/resume/studio')
  redirect('/dashboard/resume/studio')
}
