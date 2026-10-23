'use client'

import { useEffect } from 'react'
import { Lock } from 'lucide-react'
import { posthog } from '@/lib/posthog/client'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LOCKED_TITLES, lockedReason, planChangeMailto, type EntitlementFeature } from '@/lib/plans/entitlements'

// The calm "this is part of the paid plan" state, shared by every locked
// screen and control: a quiet card (no warning colors), what is locked, why,
// and the one next step. Fires entitlement_locked_viewed once per view.
export function LockedFeature({ feature, slug, plan, compact = false }: { feature: EntitlementFeature; slug: string; plan: string; compact?: boolean }) {
  useEffect(() => {
    posthog.capture('entitlement_locked_viewed', { feature, plan, slug })
  }, [feature, plan, slug])

  return (
    <div role="status" className={cn('flex flex-col items-start gap-3 rounded-lg border border-border bg-muted/40', compact ? 'p-4' : 'p-6')}>
      <div className="flex items-center gap-2">
        <Lock className="size-4 text-muted-foreground" aria-hidden="true" />
        <h2 className={cn('font-medium', compact ? 'text-sm' : 'text-base')}>{LOCKED_TITLES[feature]}</h2>
      </div>
      <p className="max-w-xl text-sm text-muted-foreground">{lockedReason(feature)}</p>
      <a
        href={planChangeMailto(feature, slug)}
        onClick={() => posthog.capture('entitlement_upgrade_requested', { feature, plan, slug })}
        className={cn(buttonVariants({ size: 'sm' }))}
      >
        Ask to switch on the paid plan
      </a>
    </div>
  )
}
