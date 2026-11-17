'use client'

import { useActionState, useEffect } from 'react'
import { Lock } from 'lucide-react'
import { posthog } from '@/lib/posthog/client'
import { buttonVariants } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import { LOCKED_TITLES, LOCK_PITCH, TRIAL_DAYS, lockedReason, planChangeMailto, type EntitlementFeature } from '@/lib/plans/entitlements'
import { startTrial, type TrialResult } from '@/app/i/[slug]/(portal)/plan-actions'

// Locked is a preview, not a wall: what you would get, a sample of the real thing, and one button. Where the organization has not
// used its trial, the button starts it (30 days of everything, nothing billed); otherwise it asks NextChapter to switch the paid plan
// on. Fires entitlement_locked_viewed once per view.
export function LockedFeature({
  feature, slug, plan, compact = false, trial = 'none', canStart = true,
}: {
  feature: EntitlementFeature
  slug: string
  plan: string
  compact?: boolean
  trial?: 'available' | 'ended' | 'none'
  // Only an administrator can start the trial; anyone else is told who to ask.
  canStart?: boolean
}) {
  useEffect(() => {
    posthog.capture('entitlement_locked_viewed', { feature, plan, slug, trial })
  }, [feature, plan, slug, trial])
  const [state, action] = useActionState<TrialResult, FormData>(startTrial.bind(null, slug, feature), undefined)
  const pitch = LOCK_PITCH[feature]

  return (
    <div role="status" className={cn('overflow-hidden rounded-xl border border-primary/30 bg-card', compact ? 'p-4' : 'p-6')}>
      <div className={cn('grid gap-6', !compact && 'md:grid-cols-[1.2fr_1fr]')}>
        <div className="space-y-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            <Lock className="size-3.5" aria-hidden="true" />
            {LOCKED_TITLES[feature]}
          </p>
          <h2 className={cn('font-semibold tracking-tight', compact ? 'text-base' : 'text-xl')}>{pitch.headline}</h2>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {pitch.bullets.map((b) => (
              <li key={b} className="flex gap-2">
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                {b}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {trial === 'available' && canStart ? (
              <form action={action}>
                <SubmitButton pendingLabel="Starting your trial…">
                  Start your {TRIAL_DAYS}-day free trial
                </SubmitButton>
              </form>
            ) : (
              <a href={planChangeMailto(feature, slug)} onClick={() => posthog.capture('entitlement_upgrade_requested', { feature, plan, slug })} className={cn(buttonVariants({ size: 'sm' }))}>
                {trial === 'ended' ? 'Ask to switch the paid plan back on' : 'Ask to switch on the paid plan'}
              </a>
            )}
            <span className="text-xs text-muted-foreground">
              {trial === 'available' && canStart
                ? 'Everything in the paid plan opens at once. Nothing is billed, and nothing is deleted when it ends.'
                : trial === 'available'
                  ? 'Ask your administrator to start the free trial.'
                  : trial === 'ended'
                    ? 'Your free trial has ended. Everything you made is kept.'
                    : lockedReason(feature)}
            </span>
          </div>
          {state?.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
        </div>
        {!compact && (
          <div aria-hidden="true" className="select-none rounded-lg border border-border bg-muted/40 p-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">{pitch.sampleTitle}</p>
            <ul className="divide-y divide-border text-sm">
              {pitch.sample.map((row) => (
                <li key={row.join('|')} className="flex items-center justify-between gap-3 py-2">
                  <span>{row[0]}</span>
                  {row[1] && <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{row[1]}</span>}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">Sample, not your data.</p>
          </div>
        )}
      </div>
    </div>
  )
}
