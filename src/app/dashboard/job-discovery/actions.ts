'use server'

import { revalidatePath } from 'next/cache'
import type { JobReactionType, NotInterestedReason } from '@prisma/client'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { surfaceNewJobs, generateReactionSummary } from '@/lib/network/job-discovery'

async function getAuthedProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

export async function refreshSurfacedJobs() {
  const profile = await getAuthedProfile()
  if (!profile) return

  await surfaceNewJobs(profile.id)
  revalidatePath('/dashboard/job-discovery')
}

export async function reactToJob(jobId: string, reaction: JobReactionType, reason: NotInterestedReason | null) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.surfacedJob.updateMany({
    where: { id: jobId, candidateId: profile.id },
    data: { reaction, reactionReason: reason, reactedAt: new Date() },
  })
  revalidatePath('/dashboard/job-discovery')
}

export type SummaryFormState = { summary?: string; error?: string } | undefined

export async function getReactionSummaryAction(_prevState: SummaryFormState): Promise<SummaryFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const summary = await generateReactionSummary(profile.id)
  if (!summary) {
    return { error: 'React to a few more jobs first — I need at least 3 reactions to spot a real pattern.' }
  }
  return { summary }
}
