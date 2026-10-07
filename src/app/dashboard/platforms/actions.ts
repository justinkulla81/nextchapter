'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { getPlatform } from '@/lib/platforms/directory'

async function currentCandidateId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return (await getOrCreateCandidateProfile(user.id)).id
}

function revalidateFor(platformKey: string) {
  revalidatePath(getPlatform(platformKey)?.kind === 'LEARNING' ? '/dashboard/learning' : '/dashboard/interim-work')
}

// "This isn't right" on a detected platform. The row stays (marked
// dismissed) so the next inbox sync doesn't re-create it; badges already
// earned stay too, the platform just stops showing and stops earning.
export async function dismissPlatformDetection(platformKey: string): Promise<{ ok: boolean }> {
  const candidateId = await currentCandidateId()
  if (!candidateId) return { ok: false }
  const row = await prisma.candidatePlatformActivity.updateMany({
    where: { candidateId, platformKey, dismissedAt: null },
    data: { dismissedAt: new Date() },
  })
  if (row.count > 0) {
    const activity = await prisma.candidatePlatformActivity.findUnique({
      where: { candidateId_platformKey: { candidateId, platformKey } },
      select: { stage: true },
    })
    captureServerEvent(candidateId, 'platform_detection_removed', { platform: platformKey, stage: activity?.stage ?? null })
  }
  revalidateFor(platformKey)
  return { ok: true }
}

export async function restorePlatformDetection(platformKey: string): Promise<{ ok: boolean }> {
  const candidateId = await currentCandidateId()
  if (!candidateId) return { ok: false }
  const row = await prisma.candidatePlatformActivity.updateMany({
    where: { candidateId, platformKey, dismissedAt: { not: null } },
    data: { dismissedAt: null },
  })
  if (row.count > 0) captureServerEvent(candidateId, 'platform_detection_restored', { platform: platformKey })
  revalidateFor(platformKey)
  return { ok: true }
}
