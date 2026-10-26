'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { requestB2bAsset, type B2bAssetState } from '@/lib/marketing/b2b-asset-actions'
import { B2B_ASSETS, type B2bAssetKey } from '@/lib/marketing/b2b-assets'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

// A free, specific offer on a partner page. Open assets are one button. Gated ones ask for a work email and the
// organization, then show the link at once.
export function B2bAssetBox({ assetKey, page }: { assetKey: B2bAssetKey; page: string }) {
  const asset = B2B_ASSETS[assetKey]
  const [state, action, pending] = useActionState<B2bAssetState, FormData>(requestB2bAsset, undefined)

  const open = (
    <Link
      href={state?.href ?? asset.href}
      onClick={() => posthog.capture('b2b_asset_opened', { asset: asset.key, page, gated: asset.gated })}
      className="inline-flex h-12 items-center rounded-full bg-action px-6 text-base font-semibold text-action-foreground hover:brightness-95"
    >
      {asset.openLabel}
    </Link>
  )

  return (
    <div className="max-w-2xl rounded-2xl border border-border bg-white p-5">
      <h3 className="font-display text-xl font-semibold text-ink">{asset.label}</h3>
      <p className="mt-2 text-base leading-relaxed text-muted-foreground">{asset.blurb}</p>

      {!asset.gated ? (
        <div className="mt-4">{open}</div>
      ) : state?.href ? (
        <div role="status" className="mt-4 space-y-3">
          <p className="text-base text-ink">Here it is. We have your details if we can help with anything after you have read it.</p>
          {open}
        </div>
      ) : (
        <form
          action={action}
          noValidate
          className={cn('mt-4 space-y-3', pending && 'cursor-wait')}
          onSubmit={() => posthog.capture('b2b_asset_submitted_client', { asset: asset.key, page })}
        >
          <input type="hidden" name="asset" value={asset.key} />
          <input type="hidden" name="page" value={page} />
          <div className="hidden" aria-hidden>
            <label htmlFor={`b2b-website-${asset.key}`}>Website</label>
            <input id={`b2b-website-${asset.key}`} name="website" type="text" tabIndex={-1} autoComplete="off" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="sr-only" htmlFor={`b2b-email-${asset.key}`}>Work email</label>
              <input
                id={`b2b-email-${asset.key}`}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                defaultValue={state?.email}
                placeholder="Work email"
                aria-invalid={state?.error ? true : undefined}
                className="h-12 w-full rounded-lg border border-border bg-white px-4 text-base"
              />
            </div>
            <div>
              <label className="sr-only" htmlFor={`b2b-org-${asset.key}`}>Organization</label>
              <input
                id={`b2b-org-${asset.key}`}
                name="organization"
                type="text"
                autoComplete="organization"
                defaultValue={state?.organization}
                placeholder="Organization"
                className="h-12 w-full rounded-lg border border-border bg-white px-4 text-base"
              />
            </div>
          </div>
          <Button type="submit" size="lg" disabled={pending} className="h-12 rounded-full bg-action px-6 text-action-foreground hover:brightness-95">
            {pending ? 'Getting it…' : asset.requestLabel}
          </Button>
          {state?.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
        </form>
      )}
    </div>
  )
}
