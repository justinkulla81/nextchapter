'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { submitGuideLead } from '@/app/resources/[slug]/actions'

export function GuideEmailGate({ slug, guideTitle }: { slug: string; guideTitle: string }) {
  const [source] = useState(() =>
    typeof window === 'undefined' ? 'organic' : sessionStorage.getItem('nc_guide_source') || 'organic'
  )
  const firedRef = useRef(false)

  const [state, formAction, pending] = useActionState(
    submitGuideLead.bind(null, slug, source),
    undefined
  )

  useEffect(() => {
    if (state?.sent && !firedRef.current) {
      firedRef.current = true
      window.gtag?.('event', 'email_captured', { guide_slug: slug, source })
    }
  }, [state?.sent, slug, source])

  if (state?.sent) {
    return (
      <div className="space-y-3 rounded-xl border border-brand/20 bg-brand/5 p-6">
        <p className="text-base font-semibold text-foreground">Check your inbox — it&apos;s on its way.</p>
        <p className="text-sm text-muted-foreground">
          We just sent the full guide to your email. While you wait, you can also grab it directly:
        </p>
        <a
          href={`/guides/${slug}.pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm font-medium text-brand underline underline-offset-4"
        >
          Download the guide →
        </a>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-light-gray bg-off-white p-6">
      <p className="text-base font-semibold text-foreground">Unlock the full guide</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter your email and we&apos;ll send you the complete &ldquo;{guideTitle}&rdquo; guide now.
      </p>
      <form
        action={formAction}
        onSubmit={() => window.gtag?.('event', 'guide_download_started', { guide_slug: slug, source })}
        className={cn('mt-4 flex flex-col gap-3 sm:flex-row sm:items-end', pending && 'cursor-progress [&_*]:cursor-progress')}
      >
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="email" className="sr-only">
            Email
          </Label>
          <Input id="email" name="email" type="email" placeholder="you@email.com" required aria-invalid={!!state?.error} />
        </div>
        <Button type="submit" disabled={pending} variant="success">
          {pending ? 'Sending…' : 'Unlock the full guide →'}
        </Button>
      </form>
      {state?.error && <p className="mt-2 text-sm text-destructive">{state.error}</p>}
      <p className="mt-3 text-xs text-muted-foreground">
        We&apos;ll also send occasional NextChapter updates. Unsubscribe anytime.
      </p>
    </div>
  )
}
