import { ActionLink } from '@/components/candidate/ActionLink'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ShowMore } from '@/components/candidate/ShowMore'
import { PlacePicker } from '@/components/market/PlacePicker'
import { compareHref, forLens, headlineKeys, summarize, type Incentives, type Lens, type PlaceView, type Row, type Verdict } from '@/lib/workforce/metro-compare'
import { cn } from '@/lib/utils'

const VERDICT_WORD: Record<Verdict, string> = { better: 'Better', worse: 'Worse', same: 'About the same' }
const VERDICT_STYLE: Record<Verdict, string> = {
  better: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
  worse: 'bg-rose-50 text-rose-900 dark:bg-rose-950 dark:text-rose-100',
  same: 'bg-muted text-muted-foreground',
}

export interface CurrentView { name: string; rows: Row[] }

// Compare places: where you are, against up to three others, measured the same way. Out of work, the first rows are
// how fast a job comes; working, they are what your pay buys. The rest sit behind "Show every measure".
export function ComparePlaces({
  employed,
  lens,
  current,
  places,
  chosen,
  metros,
  fieldName,
}: {
  employed: boolean
  lens: Lens
  /** null when the member has not told us a city we can place. */
  current: CurrentView | null
  places: PlaceView[]
  chosen: string[]
  metros: { cbsa: string; name: string }[]
  fieldName: string | null
}) {
  const lead = headlineKeys(employed)
  const split = (rows: Row[]) => {
    const shown = forLens(rows, lens)
    return { top: lead.map((k) => shown.find((r) => r.key === k)).filter((r): r is Row => !!r), rest: shown.filter((r) => !lead.includes(r.key)) }
  }
  const withIncentives = places.filter((p) => p.incentives)

  return (
    <div className="space-y-8">
      <PageHeader
        title={places.length > 0 ? 'Would moving beat staying?' : 'Compare places'}
        intro={
          employed
            ? 'Put a place next to where you live now: what your pay would buy, where your field is growing, and how the job market looks.'
            : 'Put a place next to where you live now: how fast jobs come, what is open in your field, and what it costs to live there.'
        }
      />

      <section aria-label="Places" className="space-y-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="What to compare">
          {(
            [
              ['job', 'For a job search'],
              ['life', 'Just for life there'],
            ] as const
          ).map(([key, label]) => (
            <ActionLink
              key={key}
              href={compareHref(chosen, key)}
              kind={lens === key ? 'dark' : 'secondary'}
              event="compare_lens_changed"
              props={{ lens: key, places: chosen.length }}
            >
              {label}
            </ActionLink>
          ))}
        </div>
        <PlacePicker metros={metros} chosen={chosen} lens={lens} />
        {!current && (
          <p className="max-w-xl text-sm text-muted-foreground">
            We do not have a city we can place for you yet, so there is no baseline.{' '}
            <ActionLink href="/dashboard/profile/personal" kind="text" event="compare_places_add_city_clicked" props={{ source: 'compare_places' }}>
              Add your city and state
            </ActionLink>{' '}
            to see each place against where you are.
          </p>
        )}
      </section>

      {places.length > 0 && (
        <section aria-label="Comparison" className="space-y-6">
          <div className={cn('grid gap-4', places.length === 1 ? 'md:grid-cols-2' : places.length === 2 ? 'lg:grid-cols-3' : 'md:grid-cols-2 xl:grid-cols-4')}>
            {current && <PlaceCard title={current.name} kicker="Where you are now" rows={split(current.rows).top} showNotes />}
            {places.map((p, i) => (
              <PlaceCard key={p.cbsa} showNotes={!current && i === 0} title={p.name} summary={summarize(forLens(p.rows, lens))} rows={split(p.rows).top} chosen={chosen} cbsa={p.cbsa} lens={lens} />
            ))}
          </div>
          {places.some((p) => split(p.rows).rest.length > 0) && (
            <ShowMore page="compare_places" label="Show every measure" properties={{ places: chosen.length, lens }}>
              <div className={cn('grid gap-4', places.length === 1 ? 'md:grid-cols-2' : places.length === 2 ? 'lg:grid-cols-3' : 'md:grid-cols-2 xl:grid-cols-4')}>
                {current && <PlaceCard title={current.name} kicker="Where you are now" rows={split(current.rows).rest} showNotes />}
                {places.map((p, i) => (
                  <PlaceCard key={p.cbsa} showNotes={!current && i === 0} title={p.name} rows={split(p.rows).rest} />
                ))}
              </div>
            </ShowMore>
          )}
          <p className="max-w-2xl text-xs text-muted-foreground">
            Unemployment: BLS Local Area Unemployment Statistics, counties added up to each metro area. Cost of living: BEA regional price parities, 2024. Population and jobs by sector: Census Bureau and BLS QCEW.{' '}
            {fieldName ? `Field roles are ${fieldName} roles on NextChapter.` : ''}
          </p>
        </section>
      )}

      {withIncentives.length > 0 && (
        <section aria-label="Help with moving" className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-ink">Help with the move</h2>
          <ul className="space-y-3">
            {withIncentives.map((p) => (
              <Incentive key={p.cbsa} place={p.name} incentives={p.incentives!} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function PlaceCard({
  title,
  kicker,
  summary,
  rows,
  showNotes = false,
  chosen,
  cbsa,
  lens,
}: {
  title: string
  kicker?: string
  summary?: string
  rows: Row[]
  /** The note under a measure is said once, on the first card, not on every one. */
  showNotes?: boolean
  chosen?: string[]
  cbsa?: string
  lens?: Lens
}) {
  return (
    <article className={cn('space-y-4 rounded-2xl border p-5', kicker ? 'border-border bg-muted/40' : 'border-border bg-background')}>
      <header className="space-y-1">
        {kicker && <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{kicker}</p>}
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-lg leading-snug font-semibold text-ink">{title}</h2>
          {chosen && cbsa && lens && (
            <ActionLink
              href={compareHref(chosen.filter((c) => c !== cbsa), lens)}
              kind="text"
              event="compare_place_removed"
              props={{ cbsa, placesNow: chosen.length - 1, lens }}
            >
              Remove
            </ActionLink>
          )}
        </div>
        {summary && <p className="text-sm text-muted-foreground">{summary}</p>}
      </header>
      <dl className="space-y-4">
        {rows.map((r) => (
          <div key={r.key} className="space-y-1">
            <dt className="text-sm text-muted-foreground">{r.label}</dt>
            <dd className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-2xl font-semibold text-ink">
                {r.value ?? 'Not available'}
                {r.value && r.unit && <span className="ml-1.5 text-sm font-normal text-muted-foreground">{r.unit}</span>}
              </span>
              {r.verdict && (
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', VERDICT_STYLE[r.verdict])}>
                  {VERDICT_WORD[r.verdict]}
                  {r.versus && r.verdict !== 'same' ? ` · ${r.versus}` : ''}
                </span>
              )}
            </dd>
            {showNotes && r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
          </div>
        ))}
      </dl>
    </article>
  )
}

function Incentive({ place, incentives }: { place: string; incentives: Incentives }) {
  return (
    <li className="space-y-1 rounded-2xl border border-border p-5">
      <p className="text-base font-medium text-ink">
        {incentives.count} open {incentives.count === 1 ? 'program' : 'programs'} in our relocation catalog for {incentives.state}.
      </p>
      <p className="text-sm text-muted-foreground">
        {incentives.names.join(', ')}
        {incentives.count > incentives.names.length ? ', and more' : ''}. Rules vary by program, so check each before you count on it.
      </p>
      <ActionLink
        href="/dashboard/funding"
        kind="text"
        event="compare_incentives_clicked"
        props={{ place, state: incentives.state, count: incentives.count }}
      >
        See what you qualify for
      </ActionLink>
    </li>
  )
}
