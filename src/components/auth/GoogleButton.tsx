'use client'

import { useState } from 'react'
import { createClientLazy } from '@/lib/supabase/client-lazy'
import { Button } from '@/components/ui/button'

export function GoogleButton() {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const supabase = await createClientLazy()
    const redirectTo = new URL('/auth/callback', window.location.origin)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo.toString() },
    })

    if (error) {
      setLoading(false)
      alert(error.message)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? 'Redirecting…' : 'Continue with Google'}
    </Button>
  )
}
