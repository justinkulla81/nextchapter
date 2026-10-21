'use client'

import { useEffect } from 'react'
import { forgetMemberInBrowser } from './SignOutForm'

/** For pages reached after a server-side sign-out (deactivation): clears what the browser kept. */
export function ForgetMemberOnMount() {
  useEffect(() => {
    forgetMemberInBrowser()
  }, [])
  return null
}
