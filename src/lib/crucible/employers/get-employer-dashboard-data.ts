import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import type { CrucibleEmployerProfile } from '@prisma/client'

// Layout-level gate for every /crucible/employers/(app) route — same shape
// as getTalentDashboardData (src/lib/talent/get-talent-dashboard-data.ts):
// no session -> this portal's own login (never /auth/login, so NEN never
// funnels into the main site); no profile -> signup; profile not yet
// onboarded -> onboarding. v1 is single-owner-per-company (no seat
// resolution fallback, unlike /talent's resolveEmployerForUserId).
export async function getCrucibleEmployerDashboardData(): Promise<CrucibleEmployerProfile> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/crucible/employers/login')

  const profile = await prisma.crucibleEmployerProfile.findUnique({ where: { userId: user.id } })
  if (!profile) redirect('/crucible/employers/signup')
  if (!profile.onboardingCompletedAt) redirect('/crucible/employers/onboarding')

  return profile
}
