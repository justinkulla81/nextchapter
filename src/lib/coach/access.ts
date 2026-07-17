import 'server-only'
import { prisma } from '@/lib/prisma'
import type { Coach } from '@prisma/client'

// Coach P0-lite's access model: accessToken-gated, not Supabase-authenticated
// (see Coach/Recruiter schema comments). Every coach-scoped route/action
// re-derives the coach from the URL token and re-scopes any candidate lookup
// by coachId — this pair of helpers is that pattern, factored out so new
// Batch 13 surfaces don't each reimplement it.
export async function getCoachByToken(token: string): Promise<Coach | null> {
  return prisma.coach.findUnique({ where: { accessToken: token } })
}

export async function getCoachClient(coachId: string, clientId: string) {
  return prisma.candidateProfile.findFirst({ where: { id: clientId, coachId } })
}
