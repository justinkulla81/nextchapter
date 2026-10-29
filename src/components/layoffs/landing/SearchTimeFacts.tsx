import { SEARCH_TIME_FACTS as F } from '@/lib/layoffs/landing'

const H2 = 'text-2xl font-bold tracking-tight text-navy'

/** Why starting early pays: federal figures on how long looking has taken so far. Worded as spells in progress, never as time to find work. */
export function SearchTimeFacts() {
  return (
    <section aria-labelledby="search-time">
      <h2 id="search-time" className={H2}>Start early, and you are ahead of most people</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        People who were unemployed in {F.asOf}. These are searches still in progress, so they show how long looking has taken so far, not how long it takes to find work.
      </p>
      <ul className="mt-4 grid gap-4 sm:grid-cols-3">
        <li className="rounded-2xl bg-tint-sun p-5">
          <p className="font-display text-4xl font-bold leading-none text-tint-sun-ink">{Math.round(F.averageWeeksAll)} weeks</p>
          <p className="mt-2 text-sm">Average time looking so far, all ages ({F.averageWeeksAll}).</p>
        </li>
        <li className="rounded-2xl bg-tint-mint p-5">
          <p className="font-display text-4xl font-bold leading-none text-tint-mint-ink">{Math.round(F.averageWeeks5564)} weeks</p>
          <p className="mt-2 text-sm">Average so far for ages 55 to 64 ({F.averageWeeks5564}).</p>
        </li>
        <li className="rounded-2xl bg-tint-plum p-5">
          <p className="font-display text-4xl font-bold leading-none text-tint-plum-ink">{F.share27PlusWeeks5564}%</p>
          <p className="mt-2 text-sm">Of unemployed people 55 to 64 had been looking 27 weeks or more.</p>
        </li>
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">Source: {F.source}</p>
    </section>
  )
}
