'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { claimFirmWithToken } from '@/lib/recruiter/firm-invite'

// For someone who already has a recruiter login: take over the firm the link was made for.
export async function claimFirmAction(token: string): Promise<void> {
  const supabase = await createClient('recruiter')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/recruiters/login?next=${encodeURIComponent(`/recruiters/start/${token}`)}`)
  const recruiter = await prisma.recruiter.findUnique({ where: { userId: user.id } })
  if (!recruiter) redirect(`/recruiters/signup?firm=${encodeURIComponent(token)}`)
  const firm = await claimFirmWithToken(recruiter, token)
  redirect(firm ? '/recruiters/talent/onboarding' : `/recruiters/start/${token}`)
}
