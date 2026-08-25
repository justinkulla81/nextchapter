import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import type { Coach } from '@prisma/client'

// Supabase-session-based coach lookup (distinct from access.ts's token-based
// getCoachByToken, used by /clients/[token] etc.) — the same auth pattern
// every session-based coach page already inlined individually; factored out
// so the new (app) layout and each page can both call it without drifting.
export async function getCurrentCoach(): Promise<Coach> {
  const supabase = await createClient('coach')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/support/coach/login')

  const coach = await prisma.coach.findUnique({ where: { userId: user.id } })
  if (!coach) redirect('/support/coach/signup')

  return coach
}
