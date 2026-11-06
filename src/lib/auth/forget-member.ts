'use server'

import { cookies } from 'next/headers'
import { SERVER_COOKIES_SECURE } from '@/lib/supabase/cookie-options'
import { markerDomain, MEMBER_MARKER_COOKIE, MEMBER_NAME_COOKIE } from '@/lib/auth/member-marker'

/**
 * Takes the member's site-wide marker and first-name cookies off this browser (src/lib/auth/member-marker.ts). Both are HTTP-only,
 * so the page cannot clear them; the sign-out action does, with the same domain and path they were set with, so the main site's
 * header stops greeting the previous member on a shared computer.
 */
export async function forgetMemberCookies(): Promise<void> {
  try {
    const jar = await cookies()
    for (const name of [MEMBER_MARKER_COOKIE, MEMBER_NAME_COOKIE]) {
      jar.set(name, '', {
        domain: markerDomain(process.env.NEXT_PUBLIC_APP_URL),
        path: '/',
        maxAge: 0,
        expires: new Date(0),
        sameSite: 'lax',
        secure: SERVER_COOKIES_SECURE,
        httpOnly: true,
      })
    }
  } catch {
    // Called while a page renders, where cookies cannot be changed: the deactivated page calls it again from the browser.
  }
}
