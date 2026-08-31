import Link from 'next/link'
import { Check } from 'lucide-react'
import { markInterimOutreachStarted } from '@/app/dashboard/interim-work/actions'
import { InterimOfferDefinitionForm } from '@/components/dashboard/InterimOfferDefinitionForm'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import type { LaunchPhase } from '@/lib/gig-directory/interim-launch-plan'

export function InterimLaunchPlanTracker({ phases }: { phases: LaunchPhase[] }) {
  const completedCount = phases.filter((p) => p.completed).length

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Launch plan</h2>
        <p className="text-sm text-muted-foreground">
          {completedCount} of {phases.length} phases done — work through them in order, or jump to
          whichever fits where you are today.
        </p>
      </div>
      <div className="space-y-3">
        {phases.map((phase) => (
          <div key={phase.number} id={`launch-plan-phase-${phase.number}`} className="rounded-lg border border-border p-4">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  phase.completed
                    ? 'bg-success/10 text-success'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {phase.completed ? <Check className="size-3.5" /> : phase.number}
              </span>
              <div className="flex-1 space-y-2">
                <div>
                  <p className="font-medium text-foreground">{phase.title}</p>
                  <p className="text-sm text-muted-foreground">{phase.description}</p>
                </div>

                {/* Phase 1's own form renders once, prominently, at the top of
                    the page (see interim-work/page.tsx's own
                    #gig-directory-unlock block) rather than duplicated here —
                    this row would otherwise render it a second time, hidden
                    inside this collapsed launch-plan details element. */}
                {phase.number === 2 && !phase.completed && <InterimOfferDefinitionForm />}
                {phase.number === 6 && !phase.completed && (
                  <form action={markInterimOutreachStarted}>
                    <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
                      I&apos;ve started reaching out
                    </SubmitButton>
                  </form>
                )}
                {phase.cta && !phase.completed && (
                  <Link
                    href={phase.cta.href}
                    className="inline-block text-sm font-medium text-primary underline underline-offset-4"
                  >
                    {phase.cta.label}
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
