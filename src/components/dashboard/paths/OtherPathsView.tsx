import { ActionSubmit } from '@/components/candidate/ActionSubmit'
import { ChoiceButtons } from '@/components/candidate/ChoiceButtons'
import { ShowMore } from '@/components/candidate/ShowMore'
import { TrackedAction } from '@/components/candidate/TrackedAction'
import { Chip, H2 } from '@/components/candidate/ui'
import { PARALLEL_PATHS } from '@/lib/job-reviews/constants'
import { getJourney, type JourneyType } from '@/lib/journey/journey'
import {
  INCOME_NEED_OPTIONS,
  SIDE_GOALS,
  SWITCHABLE_MAIN,
  incomeNeedOf,
  incomeRecommendation,
  previousMainOf,
  sideDetailsOf,
  type ParallelPathCard,
} from '@/lib/journey/paths'
import { saveIncomeNeed, saveSideWork, switchMainFocus } from '@/app/dashboard/other-paths/actions'

// "Your other paths": what the member does next to their main focus. The main journey keeps the weekly plan; each path here adds
// one step. Shared by the page and the dev preview (sample data).

const INPUT = 'h-10 w-full max-w-xs rounded-lg border border-border bg-background px-3 text-sm text-ink focus-visible:ring-2 focus-visible:ring-ink/40'

export function OtherPathsView({
  main,
  journeyDetails,
  kinds,
  cards,
  workingNow = false,
  buyStarted,
}: {
  main: JourneyType | null
  journeyDetails: unknown
  kinds: string[] | null
  cards: ParallelPathCard[]
  workingNow?: boolean
  buyStarted: boolean
}) {
  const need = incomeNeedOf(journeyDetails)
  const rec = incomeRecommendation({ need, main, kinds, workingNow })
  const side = sideDetailsOf(journeyDetails)
  const previous = previousMainOf(journeyDetails)
  const mainLabel = main ? getJourney(main).label : 'Your main focus'
  const held = new Set(kinds ?? [])
  const switchable = SWITCHABLE_MAIN.filter((j) => j !== main && (j !== 'BUY_BUSINESS' || buyStarted))

  return (
    <div className="space-y-10">
      <section className="space-y-4" aria-labelledby="paths-income">
        <H2 id="paths-income">How soon do you need income?</H2>
        <p className="text-sm text-muted-foreground">
          Why we ask: it decides whether we suggest paid work next to your main plan. We do not ask for amounts here. Private to you: never shown to employers, recruiters, schools or coaches.
        </p>
        <form action={saveIncomeNeed} className="space-y-3">
          <ChoiceButtons name="incomeNeed" label="How soon do you need income?" options={INCOME_NEED_OPTIONS} defaultValue={need ?? undefined} />
          <ActionSubmit variant={need ? 'secondary' : 'primary'} pendingLabel="Saving…" event="income_need_submit_pressed" props={{ had: need }}>
            Save
          </ActionSubmit>
        </form>
        {rec && (
          <div className="space-y-2 rounded-2xl bg-muted p-5 text-sm text-ink">
            <p className="font-semibold">{rec.title}</p>
            <p className="text-muted-foreground">Why you see this: {rec.because}</p>
            <TrackedAction href={rec.href} variant="secondary" event="income_recommendation_clicked" properties={{ need, main }}>
              {rec.label}
            </TrackedAction>
          </div>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="paths-alongside">
        <div className="flex flex-wrap items-center gap-2">
          <H2 id="paths-alongside">Next to {mainLabel.toLowerCase()}</H2>
          <Chip>One step each in your week</Chip>
        </div>
        <p className="text-sm text-muted-foreground">Your plan stays built around your main focus. Each path below adds one step, never more.</p>

        <form action={saveSideWork} className="space-y-5 rounded-2xl border border-border p-5">
          <p className="text-base font-semibold text-ink">Side or part-time work</p>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-ink">What do you do?</legend>
            <p className="text-sm text-muted-foreground">Why we ask: the job board shows contract and part-time roles first, and your coach sees it.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {PARALLEL_PATHS.map((o) => (
                <label key={o.value} className="flex items-start gap-2 text-sm text-ink">
                  <input type="checkbox" name="kind" value={o.value} defaultChecked={held.has(o.value)} className="mt-0.5" />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-semibold text-ink">
              Hours a week
              <input name="hours" inputMode="numeric" defaultValue={side.hours ?? ''} placeholder="5" className={INPUT} />
            </label>
            <label className="space-y-1.5 text-sm font-semibold text-ink">
              About what it earns a month, in dollars
              <input name="income" inputMode="numeric" defaultValue={side.income ?? ''} placeholder="1500" className={INPUT} />
            </label>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-ink">What is it for?</legend>
            <select name="goal" aria-label="What is it for?" defaultValue={side.goal ?? ''} className={INPUT}>
              <option value="">Choose one</option>
              {SIDE_GOALS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
            <p className="text-sm text-muted-foreground">Why we ask: it sets the one step we add each week, and your runway counts the income.</p>
          </fieldset>
          <ActionSubmit pendingLabel="Saving…" event="side_work_submit_pressed" props={{ main }}>
            Save side work
          </ActionSubmit>
        </form>

        {cards
          .filter((c) => c.key === 'buy')
          .map((c) => (
            <div key={c.key} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border p-5">
              <div className="space-y-1">
                <p className="text-base font-semibold text-ink">{c.label}</p>
                <p className="text-sm text-ink">Where you are: {c.line}</p>
                <p className="text-sm text-muted-foreground">Why you see this: {c.because}</p>
              </div>
              <TrackedAction href={c.href} variant="secondary" event="parallel_path_opened" properties={{ path: c.key, main }}>
                Open
              </TrackedAction>
            </div>
          ))}
        {!buyStarted && main !== 'BUY_BUSINESS' && (
          <p className="text-sm text-muted-foreground">
            Thinking about owning a business?{' '}
            <TrackedAction href="/dashboard/buy-a-business" variant="text" event="parallel_path_opened" properties={{ path: 'buy', main, started: false }}>
              Start a buying plan
            </TrackedAction>
          </p>
        )}
      </section>

      {(switchable.length > 0 || previous) && (
        <ShowMore label="Change your main focus" event="parallel_paths_switch_opened" properties={{ main }}>
          <section className="space-y-3" aria-labelledby="paths-switch">
            <H2 id="paths-switch">Make another path your main focus</H2>
            <p className="text-sm text-muted-foreground">
              Your weekly plan, menu and emails follow your main focus. Switching keeps everything you told us about the other paths, and you can go back.
            </p>
            <div className="flex flex-wrap gap-3">
              {switchable.map((j) => (
                <form key={j} action={switchMainFocus}>
                  <input type="hidden" name="to" value={j} />
                  <ActionSubmit variant="secondary" pendingLabel="Switching…" event="parallel_path_switch_pressed" props={{ from: main, to: j }}>
                    {j === 'BUY_BUSINESS' ? 'Make buying a business my main focus' : 'Make full-time fractional work my main focus'}
                  </ActionSubmit>
                </form>
              ))}
              {previous && previous !== main && (
                <form action={switchMainFocus}>
                  <input type="hidden" name="to" value="BACK" />
                  <ActionSubmit variant="secondary" pendingLabel="Switching…" event="parallel_path_switch_pressed" props={{ from: main, to: previous, direction: 'back' }}>
                    Go back to {getJourney(previous).label.toLowerCase()}
                  </ActionSubmit>
                </form>
              )}
            </div>
          </section>
        </ShowMore>
      )}
    </div>
  )
}
