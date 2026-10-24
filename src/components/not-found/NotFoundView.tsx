'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import posthog from 'posthog-js'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type NotFoundAudience = 'candidate' | 'admin' | 'public'

// The page people land on when an address does not exist. One headline, one primary action
// (back to the right home), and a plain way to tell us the link was wrong.
export function NotFoundView({
  audience,
  homeHref,
  homeLabel,
  reportHref,
  pathOverride,
}: {
  audience: NotFoundAudience
  homeHref: string
  homeLabel: string
  /** Where "Report this error" goes; the page address is added to it here. */
  reportHref: string
  /** Dev preview only: the address to show instead of the browser's. */
  pathOverride?: string
}) {
  const pathname = usePathname()
  const path = pathOverride ?? pathname

  useEffect(() => {
    posthog.capture('not_found_viewed', { path, audience })
  }, [path, audience])

  const href = `${reportHref}${reportHref.includes('?') ? '&' : '?'}from=${encodeURIComponent(path)}`

  return (
    <main className="theme-redesign mx-auto flex min-h-[70vh] w-full max-w-xl flex-col justify-center px-6 py-16 text-ink">
      <h1 className="font-display text-3xl font-semibold tracking-tight">We can’t find that page</h1>
      <p className="mt-3 text-base text-muted-foreground">
        {audience === 'admin'
          ? 'This address doesn’t exist yet, or it hasn’t been published. Nothing is wrong with your account.'
          : 'The link may be old or mistyped, or the page may have moved. Nothing is wrong with your account.'}
      </p>
      <p className="mt-2 break-all text-sm text-muted-foreground">Address: {path}</p>
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link
          href={homeHref}
          className={cn(buttonVariants({ size: 'lg' }), 'h-12 rounded-full bg-action px-6 text-action-foreground hover:brightness-95')}
        >
          {homeLabel}
        </Link>
        <Link
          href={href}
          onClick={() => posthog.capture('not_found_report_clicked', { path, audience })}
          className="text-sm font-medium text-ink underline underline-offset-4"
        >
          Report this error
        </Link>
      </div>
    </main>
  )
}
