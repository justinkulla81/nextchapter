import type { ReactNode } from 'react'
import { Meter } from '@/components/candidate/ui'
import { BUNDLES, bundlePosition, type BundleId } from '@/lib/onboarding/bundles'

// Every bundle opens the same way: where you are in the five short steps, one serif headline, and why we ask,
// before the first question. Nothing else sits above the questions.
export function BundleShell({ id, children, title }: { id: BundleId; children: ReactNode; title?: string }) {
  const meta = BUNDLES[id]
  const { step, of } = bundlePosition(id)
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-ink">
          Step {step} of {of} · about {meta.seconds < 60 ? `${meta.seconds} seconds` : `${Math.round(meta.seconds / 60)} minute`}
        </p>
        <Meter pct={Math.round((step / of) * 100)} label={`Step ${step} of ${of}`} />
      </div>
      <div className="space-y-3">
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight text-balance text-ink">{title ?? meta.title}</h1>
        <p className="text-base text-muted-foreground">
          <span className="font-semibold text-ink">Why we ask: </span>
          {meta.why}
        </p>
      </div>
      {children}
    </div>
  )
}
