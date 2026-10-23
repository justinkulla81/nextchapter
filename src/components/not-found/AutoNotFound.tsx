'use client'

import { useEffect, useState } from 'react'
import { NotFoundView, type NotFoundAudience } from '@/components/not-found/NotFoundView'
import { createClient } from '@/lib/supabase/client'
import { SUPPORT_HELP_PATH } from '@/lib/help/constants'

const VIEWS: Record<NotFoundAudience, { homeHref: string; homeLabel: string; reportHref: string }> = {
  admin: { homeHref: '/', homeLabel: 'Back to admin home', reportHref: 'https://launchyournextchapter.com/contact' },
  candidate: { homeHref: '/dashboard', homeLabel: 'Back to your dashboard', reportHref: SUPPORT_HELP_PATH },
  public: { homeHref: '/', homeLabel: 'Go to the home page', reportHref: '/contact' },
}

// The root 404 must stay static: it also renders when a cached (ISR) page such as /jobs/[id] calls
// notFound(), and reading headers() or cookies() on the server there turns the page dynamic at
// runtime and returns a 500. So the server sends the public view and the browser upgrades it
// once it knows the host and whether someone is signed in.
export function AutoNotFound() {
  const [audience, setAudience] = useState<NotFoundAudience>('public')

  useEffect(() => {
    if (window.location.hostname.toLowerCase().startsWith('admin.')) {
      setAudience('admin')
      return
    }
    let cancelled = false
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (!cancelled && data.session) setAudience('candidate')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return <NotFoundView audience={audience} {...VIEWS[audience]} />
}
