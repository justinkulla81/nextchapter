import { PageHeader } from '@/components/candidate/PageHeader'
import { TrackedAction } from '@/components/candidate/TrackedAction'
import { BoardExperienceForm } from '@/components/network/BoardExperienceForm'
import { advisoryPlan, boardExperienceOf, boardSectorsOf } from '@/lib/network/advisory-boards'

// The Advisory and boards tab in Network (docs/candidate-redesign.md): one headline, one primary action, three
// sections on the first view, the rest below. What comes first depends on the board experience they told us.
export function AdvisoryBoards({ journeyDetails, coachHref, hasCoach }: { journeyDetails: unknown; coachHref: string; hasCoach: boolean }) {
  const plan = advisoryPlan(journeyDetails)
  const experience = boardExperienceOf(journeyDetails)
  return (
    <div className="space-y-8">
      <PageHeader
        title={plan.title}
        intro={plan.intro}
        action={
          <TrackedAction variant="primary" href="#next" event="advisory_step_clicked" properties={{ step: plan.next.key, experience }}>
            See your next step
          </TrackedAction>
        }
      />
      <section aria-labelledby="where-h" className="space-y-4">
        <h2 id="where-h" className="font-display text-xl font-semibold text-ink">Where you are today</h2>
        <BoardExperienceForm current={experience} sectors={boardSectorsOf(journeyDetails)} />
        <div id="next" className="scroll-mt-4 space-y-2 rounded-2xl border border-border p-5">
          <h3 className="font-display text-lg font-semibold text-ink">{plan.next.title}</h3>
          <p className="max-w-2xl text-base text-ink"><span className="font-semibold">Why:</span> {plan.next.body}</p>
        </div>
      </section>
      <details className="group rounded-xl border border-border p-4">
        <summary className="cursor-pointer list-none font-display text-xl font-semibold text-ink [&::-webkit-details-marker]:hidden">Four ways in</summary>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {plan.lanes.map((l) => (
            <li key={l.key} className="rounded-xl border border-border p-4">
              <p className="text-base font-semibold text-ink">{l.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{l.body}</p>
            </li>
          ))}
        </ul>
      </details>
      <section aria-labelledby="steps-h" className="space-y-3">
        <h2 id="steps-h" className="font-display text-xl font-semibold text-ink">What to do</h2>
        <ol className="divide-y divide-border">
          {plan.steps.map((s, i) => (
            <li key={s.key} className="flex flex-wrap items-start justify-between gap-3 py-4">
              <div className="min-w-0 max-w-2xl">
                <p className="text-base font-semibold text-ink"><span className="mr-2 text-muted-foreground">{i + 1}.</span>{s.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </div>
              {s.href && s.hrefLabel && (
                <TrackedAction variant="secondary" href={s.href} event="advisory_step_clicked" properties={{ step: s.key, experience }}>{s.hrefLabel}</TrackedAction>
              )}
            </li>
          ))}
        </ol>
      </section>
      <details className="group rounded-xl border border-border p-4">
        <summary className="cursor-pointer list-none font-display text-xl font-semibold text-ink [&::-webkit-details-marker]:hidden">Where to look</summary>
        <ul className="mt-3 space-y-3">
          {plan.sources.map((s) => (
            <li key={s.href} className="max-w-2xl">
              <TrackedAction variant="text" external href={s.href} event="advisory_source_clicked" properties={{ source: s.name, experience }}>{s.name}</TrackedAction>
              <p className="mt-0.5 text-sm text-muted-foreground">{s.about}</p>
            </li>
          ))}
        </ul>
      </details>
      <section aria-labelledby="coach-h" className="space-y-2 rounded-2xl border border-border p-5">
        <h2 id="coach-h" className="font-display text-xl font-semibold text-ink">{plan.coach.title}</h2>
        <p className="max-w-2xl text-base text-ink"><span className="font-semibold">Why:</span> {plan.coach.why}</p>
        <TrackedAction variant="secondary" href={coachHref} event="coach_offer_clicked" properties={{ reason: plan.coach.reason, experience }}>
          {hasCoach ? 'Open my coaching' : 'Find my coach'}
        </TrackedAction>
      </section>
    </div>
  )
}
