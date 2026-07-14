'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function parseHash(): { accessToken: string; refreshToken: string } | { error: string } {
  if (typeof window === 'undefined') return { error: '' }

  const raw = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
  const params = new URLSearchParams(raw)

  const errorDescription = params.get('error_description')
  if (errorDescription) return { error: errorDescription }

  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (!accessToken || !refreshToken) return { error: 'This link is invalid or has expired.' }

  return { accessToken, refreshToken }
}

// Handler for magic links minted via the Supabase Admin API (used by the
// registration-reminder cron — see src/app/api/cron/registration-reminders).
// Admin-generated links use the implicit flow: tokens arrive in the URL
// HASH fragment, which is never sent to the server — only client-side JS
// can read it. This is why this must be a page, not a Route Handler like
// /auth/callback (which handles the PKCE `?code=` links produced by
// client-initiated flows like signup/OAuth/updateUser).
export default function MagicLinkPage() {
  const router = useRouter()
  const [parsed] = useState(parseHash)
  const [error, setError] = useState<string | null>('error' in parsed ? parsed.error : null)

  useEffect(() => {
    if ('error' in parsed) return

    const supabase = createClient()
    supabase.auth
      .setSession({ access_token: parsed.accessToken, refresh_token: parsed.refreshToken })
      .then(({ error }) => {
        if (error) {
          setError('This link is invalid or has expired.')
          return
        }
        router.push('/onboarding')
        router.refresh()
      })
  }, [parsed, router])

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <p className="text-sm text-muted-foreground">
        {error ? error : 'Signing you back in…'}
      </p>
    </div>
  )
}
