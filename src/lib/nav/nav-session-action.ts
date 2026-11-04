'use server'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export type NavSession = { signedIn: boolean; firstName: string | null }

/** For the cached public header: is the visitor signed in, and what is their first name? Reads only, never creates a profile. */
export async function getNavSession(): Promise<NavSession> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    // A visitor partway through onboarding holds an anonymous session. They have no account yet, so the header treats them as signed
    // out: "My account" and the dashboard would only send them round the create-account step again.
    if (!user || user.is_anonymous) return { signedIn: false, firstName: null }
    const profile = await prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: { firstName: true } })
    // No name on the profile (an admin, coach or recruiter, or an account made before the details step): the sign-in's own name.
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>
    const metaName = [meta.given_name, meta.full_name, meta.name].find((v): v is string => typeof v === 'string' && !!v.trim())
    return { signedIn: true, firstName: profile?.firstName?.trim() || metaName?.trim().split(/\s+/)[0] || null }
  } catch {
    return { signedIn: false, firstName: null }
  }
}
