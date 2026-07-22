'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { createNamedNarrative, generateCoreNarrative } from '@/lib/narrative/generate-core-narrative'
import { generateAdaptations } from '@/lib/narrative/generate-adaptations'
import { captureServerEvent } from '@/lib/posthog/server'

async function getAuthedProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

export async function createNarrative(label: string, scenarioContext: string): Promise<{ id: string } | null> {
  const profile = await getAuthedProfile()
  if (!profile) return null

  const trimmedLabel = label.trim() || 'Untitled narrative'
  const id = await createNamedNarrative(profile.id, trimmedLabel, scenarioContext.trim() || undefined)
  if (!id) return null

  await generateAdaptations(profile.id, id)
  captureServerEvent(profile.id, 'narrative_created', { narrativeId: id, label: trimmedLabel })
  revalidatePath('/dashboard/portfolio')
  return { id }
}

export async function renameNarrative(narrativeId: string, label: string) {
  const profile = await getAuthedProfile()
  if (!profile) return

  const trimmed = label.trim()
  if (!trimmed) return

  const narrative = await prisma.candidateNarrative.findUnique({ where: { id: narrativeId } })
  if (!narrative || narrative.candidateId !== profile.id) return

  await prisma.candidateNarrative.update({ where: { id: narrativeId }, data: { label: trimmed } })
  captureServerEvent(profile.id, 'narrative_renamed', { narrativeId, label: trimmed })
  revalidatePath('/dashboard/portfolio')
}

export async function deleteNarrative(narrativeId: string) {
  const profile = await getAuthedProfile()
  if (!profile) return

  const narrative = await prisma.candidateNarrative.findUnique({ where: { id: narrativeId } })
  if (!narrative || narrative.candidateId !== profile.id) return

  // The earliest-created narrative is the implicit "default" that interview
  // prep, guides, and profile-share all read — it can never be deleted, only
  // edited or regenerated.
  const defaultNarrative = await prisma.candidateNarrative.findFirst({
    where: { candidateId: profile.id },
    orderBy: { generatedAt: 'asc' },
    select: { id: true },
  })
  if (defaultNarrative?.id === narrativeId) return

  await prisma.candidateNarrative.delete({ where: { id: narrativeId } })
  captureServerEvent(profile.id, 'narrative_deleted', { narrativeId })
  revalidatePath('/dashboard/portfolio')
}

export async function regenerateNarrative(narrativeId: string) {
  const profile = await getAuthedProfile()
  if (!profile) return

  const narrative = await prisma.candidateNarrative.findUnique({ where: { id: narrativeId } })
  if (!narrative || narrative.candidateId !== profile.id) return

  await generateCoreNarrative(profile.id, narrativeId)
  await generateAdaptations(profile.id, narrativeId)
  captureServerEvent(profile.id, 'narrative_regenerated', { narrativeId })
  revalidatePath('/dashboard/portfolio')
}

export async function updateNarrativeStatement(narrativeId: string, newStatement: string) {
  const profile = await getAuthedProfile()
  if (!profile) return

  const trimmed = newStatement.trim()
  if (!trimmed) return

  const narrative = await prisma.candidateNarrative.findUnique({ where: { id: narrativeId } })
  if (!narrative || narrative.candidateId !== profile.id) return

  await prisma.candidateNarrative.update({ where: { id: narrativeId }, data: { coreStatement: trimmed } })
  await generateAdaptations(profile.id, narrativeId)
  captureServerEvent(profile.id, 'narrative_edited', { narrativeId })
  revalidatePath('/dashboard/portfolio')
}
