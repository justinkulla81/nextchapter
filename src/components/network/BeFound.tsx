import { PageHeader } from '@/components/candidate/PageHeader'
import { TrackedAction } from '@/components/candidate/TrackedAction'
import { beFoundPlan, type BeFoundMode } from '@/lib/network/be-found'

// The Be found tab in Network (docs/candidate-redesign.md): one headline, one primary action, three sections.
export function BeFound({ mode, coachHref, hasCoach }: { mode: BeFoundMode; coachHref: string; hasCoach: boolean }) {
  const plan = beFoundPlan(mode)
  const first = plan.steps[0]
  return (
    <div className="space-y-8">
      <PageHeader
        title={plan.title}
        intro={plan.intro}
        action={
          <TrackedAction variant="primary" href="#steps" event="be_found_step_clicked" properties={{ step: first.key, mode }}>
            Start with your positioning
          </TrackedAction>
        }
      />
      {mode === 'quiet' && (
        <p className="max-w-2xl rounded-xl bg-muted/60 px-4 py-3 text-sm text-ink">
          <span className="font-semibold">Quiet version.</span> Confidential Search Mode is on, so this plan keeps your search out of it.
        </p>
      )}
      <section aria-labelledby="why-h" className="space-y-3">
        <h2 id="why-h" className="font-display text-xl font-semibold text-ink">Why now</h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {plan.why.map((w) => (
            <li key={w.title} className="rounded-xl border border-border p-4">
              <p className="text-base font-semibold text-ink">{w.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{w.body}</p>
            </li>
          ))}
        </ul>
      </section>
      <section id="steps" aria-labelledby="steps-h" className="scroll-mt-4 space-y-3">
        <h2 id="steps-h" className="font-display text-xl font-semibold text-ink">Five ways to be found</h2>
        <ol className="divide-y divide-border">
          {plan.steps.map((s, i) => (
            <li key={s.key} className="flex flex-wrap items-start justify-between gap-3 py-4">
              <div className="min-w-0 max-w-2xl">
                <p className="text-base font-semibold text-ink"><span className="mr-2 text-muted-foreground">{i + 1}.</span>{s.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </div>
              {s.href && s.hrefLabel && (
                <TrackedAction variant="secondary" href={s.href} event="be_found_step_clicked" properties={{ step: s.key, mode }}>{s.hrefLabel}</TrackedAction>
              )}
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="coach-h" className="space-y-2 rounded-2xl border border-border p-5">
        <h2 id="coach-h" className="font-display text-xl font-semibold text-ink">{plan.coach.title}</h2>
        <p className="max-w-2xl text-base text-ink"><span className="font-semibold">Why:</span> {plan.coach.why}</p>
        <TrackedAction variant="secondary" href={coachHref} event="coach_offer_clicked" properties={{ reason: plan.coach.reason, mode }}>
          {hasCoach ? 'Open my coaching' : 'Find my coach'}
        </TrackedAction>
      </section>
    </div>
  )
}
