import { ActionSubmit } from '@/components/candidate/ActionSubmit'
import { ChoiceButtons } from '@/components/candidate/ChoiceButtons'
import { ShowMore } from '@/components/candidate/ShowMore'
import { TrackedAction } from '@/components/candidate/TrackedAction'
import { Chip, H2 } from '@/components/candidate/ui'
import { PARALLEL_PATHS } from '@/lib/job-reviews/constants'
import { getJourney, type JourneyType } from '@/lib/journey/journey'
import {
  INCOME_NEED_OPTIONS,
  INTEREST_KEYS,
  INTEREST_LABELS,
  INTEREST_LEVELS,
  SIDE_GOALS,
  SWITCHABLE_MAIN,
  activePaths,
  askableInterests,
  derivedLevelsOf,
  effectiveLevelsOf,
  incomeNeedIsDerived,
  incomeNeedOf,
  incomeRecommendation,
  previousMainOf,
  sideDetailsOf,
  statedLevelsOf,
} from '@/lib/journey/paths'
import { savePathInterests, saveIncomeNeed, saveSideWork, switchMainFocus } from '@/app/dashboard/other-paths/actions'

// "Your other paths": what the member is thinking about or doing next to their main focus. The main journey keeps the weekly plan;
// a path is active only at researching or doing it, and then adds one step. Shared by the page and the dev preview (sample data).

const INPUT = 'h-10 w-full max-w-xs rounded-lg border border-border bg-background px-3 text-sm text-ink focus-visible:ring-2 focus-visible:ring-ink/40'
const NONE_OPTION = { value: 'none', label: 'Not thinking about it' }

export function OtherPathsView({
  main,
  journeyDetails,
  kinds,
  workingNow = false,
  interimInterest = false,
  buyStarted,
}: {
  main: JourneyType | null
  journeyDetails: unknown
  kinds: string[] | null
  workingNow?: boolean
  interimInterest?: boolean
  buyStarted: boolean
}) {
  const signals = { main, journeyDetails, kinds, workingNow, interimInterest }
  const need = incomeNeedOf(journeyDetails)
  const needDerived = incomeNeedIsDerived(journeyDetails)
  const rec = incomeRecommendation({ need, main, kinds, workingNow })
  const askable = askableInterests(signals)
  const derived = derivedLevelsOf(signals)
  const stated = statedLevelsOf(journeyDetails)
  const levels = effectiveLevelsOf(signals)
  const cards = activePaths(signals)
  const side = sideDetailsOf(journeyDetails)
  const previous = previousMainOf(journeyDetails)
  const mainLabel = main ? getJourney(main).label : 'Your main focus'
  const held = new Set(kinds ?? [])
  const switchable = SWITCHABLE_MAIN.filter((j) => j !== main && (j !== 'BUY_BUSINESS' || buyStarted))
  const known = INTEREST_KEYS.filter((k) => derived[k])
  const needLabel = INCOME_NEED_OPTIONS.find((o) => o.value === need)?.label

  return (
    <div className="space-y-10">
      <section className="space-y-4" aria-labelledby="paths-interest">
        <H2 id="paths-interest">What else are you thinking about?</H2>
        <p className="text-sm text-muted-foreground">
          Why we ask: it tunes your weekly plan and your coach&apos;s advice. Curious costs your plan nothing; researching or doing it adds one step. Private to you, and only your coach sees it, where you have shared your search with them.
        </p>
        {known.length > 0 && (
          <ul className="space-y-1 text-sm text-ink">
            {known.map((k) => (
              <li key={k}>
                <span className="font-semibold">{INTEREST_LABELS[k]}:</span> {INTEREST_LEVELS.find((l) => l.value === derived[k])?.label}. <span className="text-muted-foreground">We know this already.</span>
              </li>
            ))}
          </ul>
        )}
        {askable.length > 0 && (
          <form action={savePathInterests} className="space-y-4">
            {askable.map((k) => (
              <fieldset key={k} className="space-y-2">
                <legend className="text-sm font-semibold text-ink">{INTEREST_LABELS[k]}</legend>
                <ChoiceButtons name={`level_${k}`} label={INTEREST_LABELS[k]} options={[...INTEREST_LEVELS, NONE_OPTION]} defaultValue={stated[k] ?? (undefined as string | undefined)} />
              </fieldset>
            ))}
            <ActionSubmit pendingLabel="Saving…" event="paths_interest_submit_pressed" props={{ main, asked: askable }}>
              Save
            </ActionSubmit>
          </form>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="paths-income">
        <H2 id="paths-income">How long could you go without new income?</H2>
        {needDerived && needLabel ? (
          <p className="text-sm text-ink">
            About <span className="font-semibold">{needLabel.toLowerCase()}</span>. <span className="text-muted-foreground">We worked this out from the cushion you saved, so we did not ask.</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Why we ask: it decides how much of your plan is income, and whether we suggest paid work next to your search. No amounts. Private to you: never shown to employers, recruiters, schools or coaches.
          </p>
        )}
        <form action={saveIncomeNeed} className="space-y-3">
          <ChoiceButtons name="incomeNeed" label="How long could you go without new income?" options={INCOME_NEED_OPTIONS} defaultValue={needDerived ? undefined : (need ?? undefined)} />
          <ActionSubmit variant={need && !needDerived ? 'secondary' : 'primary'} pendingLabel="Saving…" event="income_need_submit_pressed" props={{ had: need, derived: needDerived }}>
            {needDerived ? 'Use this answer instead' : 'Save'}
          </ActionSubmit>
        </form>
        {rec && (
          <div className="space-y-2 rounded-2xl bg-muted p-5 text-sm text-ink">
            <p className="font-semibold">{rec.title}</p>
            <p className="text-muted-foreground">Why you see this: {rec.because}</p>
            <TrackedAction href={rec.href} variant="secondary" event="income_recommendation_clicked" properties={{ need, main, strength: rec.strength }}>
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
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing is active next to your main focus. Set an item above to researching or doing it and it appears here with its one step.</p>
        ) : (
          <ul className="space-y-3">
            {cards.map((c) => (
              <li key={c.key} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border p-4">
                <div className="space-y-1">
                  <p className="text-base font-semibold text-ink">{c.label}</p>
                  <p className="text-sm text-ink">{c.line}</p>
                  <p className="text-sm text-muted-foreground">Why you see this: {c.because}</p>
                </div>
                <TrackedAction href={c.href} variant="text" event="parallel_path_opened" properties={{ path: c.key, level: c.level, main }}>
                  Open
                </TrackedAction>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted-foreground">Your plan stays built around {mainLabel.toLowerCase()}.</p>

        <ShowMore label="Side or part-time work: hours, income and what it is for" event="side_work_opened" properties={{ main, level: levels.side ?? null }}>
          <form action={saveSideWork} id="side" className="space-y-5 rounded-2xl border border-border p-5">
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
        </ShowMore>
        {!buyStarted && main !== 'BUY_BUSINESS' && (
          <p className="text-sm text-muted-foreground">
            Want to go further on owning a business?{' '}
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
