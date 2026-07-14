'use client'

import { useState } from 'react'
import { resendConfirmationEmail } from '@/app/dashboard/actions'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function EmailConfirmationBanner({ email }: { email: string }) {
  const [sent, setSent] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <Card className="border-amber-300 bg-amber-50">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
        <div>
          <p className="text-sm text-amber-900">
            Please confirm your email ({email}) so you don&apos;t lose access to your results.
          </p>
          {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || sent}
          onClick={async () => {
            setPending(true)
            setError(null)
            const result = await resendConfirmationEmail()
            setPending(false)
            if (result.error) {
              setError(result.error)
              return
            }
            setSent(true)
          }}
        >
          {sent ? 'Sent!' : pending ? 'Sending…' : 'Resend confirmation email'}
        </Button>
      </CardContent>
    </Card>
  )
}
