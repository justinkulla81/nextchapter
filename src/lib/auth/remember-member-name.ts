'use server'

import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { SERVER_COOKIES_SECURE } from '@/lib/supabase/cookie-options'
import { encodeMemberName, markerDomain, MEMBER_MARKER_MAX_AGE_SECONDS, MEMBER_NAME_COOKIE } from '@/lib/auth/member-marker'

/**
 * Runs on the candidate host, where the member's session is. Leaves their first name on the whole site's domain so the main
 * site's header can say "Hi, Justin" (the main host never sees the session, src/lib/auth/member-marker.ts). The name comes from
 * the signed-in member's own profile, never from the caller.
 */
export async function rememberMemberName(): Promise<void> {
  try {
    const { data: { user } } = await (await createClient()).auth.getUser()
    if (!user || user.is_anonymous) return
    const profile = await prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: { firstName: true } })
    const firstName = profile?.firstName?.trim()
    if (!firstName) return
    const jar = await cookies()
    const value = encodeMemberName(firstName)
    if (jar.get(MEMBER_NAME_COOKIE)?.value === value) return
    jar.set(MEMBER_NAME_COOKIE, value, {
      domain: markerDomain(process.env.NEXT_PUBLIC_APP_URL),
      path: '/',
      maxAge: MEMBER_MARKER_MAX_AGE_SECONDS,
      sameSite: 'lax',
      secure: SERVER_COOKIES_SECURE,
      httpOnly: true,
    })
  } catch {
    // The greeting is a nicety; never break a dashboard page for it.
  }
}
