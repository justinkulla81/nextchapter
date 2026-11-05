'use client'

import { useEffect } from 'react'
import { rememberMemberName } from '@/lib/auth/remember-member-name'

/** Once per browser session, leaves the member's first name where the main site's header can read it. Renders nothing. */
export function MemberNameSync() {
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem('nc_name_synced')) return
      window.sessionStorage.setItem('nc_name_synced', '1')
    } catch {}
    void rememberMemberName()
  }, [])
  return null
}
