'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { requestFromPool } from '@/lib/recruiter/introduction-requests'

export async function requestIntroductionFromPool(candidateId: string): Promise<void> {
  const supabase = await createClient('recruiter')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  const recruiter = await prisma.recruiter.findUnique({ where: { userId: user.id }, select: { id: true } })
  if (!recruiter) return

  const result = await requestFromPool(recruiter.id, candidateId)
  captureServerEvent(recruiter.id, 'recruiter_pool_request_sent', { ok: result.ok, reason: result.ok ? null : result.reason })
  revalidatePath('/recruiters/pool')
}
