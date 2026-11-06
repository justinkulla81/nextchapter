'use server'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { decodeMemberName, MEMBER_MARKER_COOKIE, MEMBER_NAME_COOKIE } from '@/lib/auth/member-marker'

export type NavSession = { signedIn: boolean; firstName: string | null }

/** For the cached public header: is the visitor signed in, and what is their first name? Reads only, never creates a profile. */
export async function getNavSession(): Promise<NavSession> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    // A visitor partway through onboarding holds an anonymous session. They have no account yet, so the header treats them as signed
    // out: "My account" and the dashboard would only send them round the create-account step again. Unless this browser also belongs
    // to a member: a member logs in on the candidate host, whose session cookie this host never sees, and the site-wide marker
    // (a flag, not a credential, src/lib/auth/member-marker.ts) says so. The candidate host leaves their first name beside it. A
    // leftover anonymous session from testing onboarding must not hide that.
    if (!user || user.is_anonymous) {
      const jar = await cookies()
      return jar.has(MEMBER_MARKER_COOKIE) ? { signedIn: true, firstName: decodeMemberName(jar.get(MEMBER_NAME_COOKIE)?.value) } : { signedIn: false, firstName: null }
    }
    const profile = await prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: { firstName: true } })
    // No name on the profile (an admin, coach or recruiter, or an account made before the details step): the sign-in's own name.
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>
    const metaName = [meta.given_name, meta.full_name, meta.name].find((v): v is string => typeof v === 'string' && !!v.trim())
    return { signedIn: true, firstName: profile?.firstName?.trim() || metaName?.trim().split(/\s+/)[0] || null }
  } catch {
    return { signedIn: false, firstName: null }
  }
}
