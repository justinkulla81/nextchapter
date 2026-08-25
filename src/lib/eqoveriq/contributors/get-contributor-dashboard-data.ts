import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import type { EqOverIqContributorProfile } from '@prisma/client'

// Layout-level gate for every /eqoveriq/contributors/(app) route — same
// shape as getCrucibleEmployerDashboardData: no session -> this portal's
// own login (never /auth/login, so EQoverIQ never funnels into the main
// site); no profile -> signup; application not yet submitted -> onboarding.
// Unlike the NEN employer gate, completion is checked via `submittedAt`,
// not an "onboarding complete" flag — a PENDING applicant still reaches the
// portal shell (to see their status), it's only an unsubmitted application
// that's blocked from entering at all.
export async function getEqOverIqContributorDashboardData(): Promise<EqOverIqContributorProfile> {
  const supabase = await createClient('eqoveriq')
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/eqoveriq/contributors/login')

  const profile = await prisma.eqOverIqContributorProfile.findUnique({ where: { userId: user.id } })
  if (!profile) redirect('/eqoveriq/contributors/signup')
  if (!profile.submittedAt) redirect('/eqoveriq/contributors/onboarding')

  return profile
}
