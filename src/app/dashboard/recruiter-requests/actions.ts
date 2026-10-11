'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { respondToRequest } from '@/lib/recruiter/introduction-requests'

export async function answerRecruiterRequest(introductionId: string, approve: boolean): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  const profile = await prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: { id: true } })
  if (!profile) return

  const ok = await respondToRequest(profile.id, introductionId, approve)
  if (ok) captureServerEvent(profile.id, approve ? 'recruiter_request_approved' : 'recruiter_request_declined')
  revalidatePath('/dashboard/recruiter-requests')
}
