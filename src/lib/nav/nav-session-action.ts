'use server'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export type NavSession = { signedIn: boolean; firstName: string | null }

/** For the cached public header: is the visitor signed in, and what is their first name? Reads only, never creates a profile. */
export async function getNavSession(): Promise<NavSession> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { signedIn: false, firstName: null }
    const profile = await prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: { firstName: true } })
    return { signedIn: true, firstName: profile?.firstName?.trim() || null }
  } catch {
    return { signedIn: false, firstName: null }
  }
}
