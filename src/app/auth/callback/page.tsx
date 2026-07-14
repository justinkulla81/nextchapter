import { Suspense } from 'react'
import { CallbackHandler } from '@/components/auth/CallbackHandler'

export default function AuthCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Verifying your link…</p>}>
        <CallbackHandler />
      </Suspense>
    </div>
  )
}
