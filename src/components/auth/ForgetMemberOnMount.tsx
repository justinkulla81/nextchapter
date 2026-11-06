'use client'

import { useEffect } from 'react'
import { forgetMemberInBrowser } from './SignOutForm'
import { forgetMemberCookies } from '@/lib/auth/forget-member'

/** For pages reached after a server-side sign-out (deactivation): clears what the browser kept, and the member cookies the page cannot reach. */
export function ForgetMemberOnMount() {
  useEffect(() => {
    forgetMemberInBrowser()
    void forgetMemberCookies()
  }, [])
  return null
}
