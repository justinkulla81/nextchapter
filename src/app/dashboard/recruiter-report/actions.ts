'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { clearDossierGeneratedCache } from '@/lib/reports/dossier-refresh'

export type PositioningFormState = { error?: string } | undefined

// Mandatory approval gate for the Dossier's Positioning Statement (Prompt
// 47) — an AI draft never becomes the final, Dossier-eligible text without
// this. The candidate can edit the draft before approving; whatever text
// they submit here is what gets saved as final.
export async function approvePositioningStatement(
  _prevState: PositioningFormState,
  formData: FormData
): Promise<PositioningFormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'You need to be logged in to do this.' }
  }

  const text = (formData.get('positioningStatementText') as string | null)?.trim()
  if (!text) {
    return { error: 'Please review the statement before approving it.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { positioningStatementText: text, positioningStatementSetAt: new Date() },
  })

  captureServerEvent(profile.id, 'dossier_positioning_statement_approved')
  revalidatePath('/dashboard/recruiter-report')
}

// Mandatory approval gate for the Dossier's Self-Awareness section — exact
// mirror of approvePositioningStatement above. Victoria's draft (curated
// from raw growthAreas self-report, see getOrDraftSelfAwareness) never
// becomes the final, Dossier-eligible text without this. The candidate can
// edit the draft before approving; whatever text they submit here is what
// gets saved as final.
export async function approveSelfAwareness(
  _prevState: PositioningFormState,
  formData: FormData
): Promise<PositioningFormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'You need to be logged in to do this.' }
  }

  const text = (formData.get('selfAwarenessText') as string | null)?.trim()
  if (!text) {
    return { error: 'Please review the text before approving it.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { selfAwarenessText: text, selfAwarenessSetAt: new Date() },
  })

  captureServerEvent(profile.id, 'dossier_self_awareness_approved')
  revalidatePath('/dashboard/recruiter-report')
}

// Explicit refresh for the Dossier's cached LLM generations: the two
// per-view generations (proof-point follow-ups + job-reaction pattern
// summary) plus the self-caching Positioning Statement and Self-Awareness
// drafts. Clearing the cache columns is all that's needed — the next render
// regenerates and re-caches via getCachedGenerations /
// getOrDraftPositioningStatement / getOrDraftSelfAwareness. Deliberately
// candidate-initiated: it's what keeps generation cost tied to intent rather
// than to page views. Never touches positioningStatementText/
// selfAwarenessText (the human-approved columns) — only the AI drafts are
// ever cleared here.
export async function regenerateDossierSections(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)

  await clearDossierGeneratedCache(profile.id)

  captureServerEvent(profile.id, 'dossier_sections_regenerated', {})

  revalidatePath('/dashboard/recruiter-report')
  revalidatePath('/dashboard/coach-dossier')
}
