'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'

async function getAuthedProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

export async function approvePortfolioAccessRequest(requestId: string) {
  const profile = await getAuthedProfile()
  if (!profile) return

  const request = await prisma.portfolioAccessRequest.findFirst({
    where: { id: requestId, candidateId: profile.id },
  })
  if (!request) return

  await prisma.portfolioAccessRequest.update({
    where: { id: requestId },
    data: { status: 'APPROVED', respondedAt: new Date() },
  })

  captureServerEvent(profile.id, 'portfolio_access_approved', {
    candidateId: profile.id,
    recruiterId: request.recruiterId,
  })

  revalidatePath('/dashboard')
}

export async function declinePortfolioAccessRequest(requestId: string) {
  const profile = await getAuthedProfile()
  if (!profile) return

  const request = await prisma.portfolioAccessRequest.findFirst({
    where: { id: requestId, candidateId: profile.id },
  })
  if (!request) return

  await prisma.portfolioAccessRequest.update({
    where: { id: requestId },
    data: { status: 'DECLINED', respondedAt: new Date() },
  })

  captureServerEvent(profile.id, 'portfolio_access_declined', {
    candidateId: profile.id,
    recruiterId: request.recruiterId,
  })

  revalidatePath('/dashboard')
}
