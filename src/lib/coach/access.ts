import 'server-only'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import type { Coach } from '@prisma/client'

// Every coach-scoped route/action re-derives the coach from the URL token and
// re-scopes any candidate lookup by coachId — this pair of helpers is that
// pattern, factored out so surfaces don't each reimplement it.
//
// The token alone is NOT a credential: the same value is embedded in the
// invite link a coach hands to every prospective client
// (/api/coach-invite/<token>), and /support/coach/signup is open, so anyone
// holding an invite link could otherwise open that coach's whole client area.
// The token must therefore belong to the coach who is signed in right now.
export async function getCoachByToken(token: string): Promise<Coach | null> {
  const supabase = await createClient('coach')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const coach = await prisma.coach.findUnique({ where: { accessToken: token } })
  if (!coach || !coach.userId || coach.userId !== user.id) return null
  return coach
}

export async function getCoachClient(coachId: string, clientId: string) {
  return prisma.candidateProfile.findFirst({ where: { id: clientId, coachId } })
}
