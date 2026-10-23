import Link from 'next/link'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { FUNDING_STATS } from '@/lib/benefits/public-stats'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'

// The homepage's funding band: there is money to move, retrain and learn, and members get the ones that fit
// them, ranked. Numbers come from the catalog (src/lib/benefits/public-stats.ts) so they are never invented.

const action = 'inline-flex h-14 items-center rounded-full bg-action px-8 text-base font-semibold text-action-foreground hover:brightness-95'
const fmt = (n: number) => n.toLocaleString('en-US')

export function HomeFunding() {
  const s = FUNDING_STATS
  const rows = [
    { goal: 'move' as const, title: 'Money to move', sample: s.examples.move[0] },
    { goal: 'retrain' as const, title: 'Money to retrain', sample: s.examples.retrain[0] },
    { goal: 'learn' as const, title: 'Free courses and certificates', sample: null },
  ]
  return (
    <section className="bg-white py-16" aria-labelledby="home-funding-heading">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold tracking-widest text-brand uppercase">Members only, and free</p>
          <h2 id="home-funding-heading" className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink text-balance sm:text-5xl">
            There is money to relocate, retrain and reskill. We find the part that is yours.
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">
            Relocation grants, home-buying help, tuition aid, federal training money and free courses exist across the country. Whether you qualify depends on
            where you live, where you would go and your situation. Join and we rank the programs that fit you, best first, and leave out the ones that do not.
          </p>
        </div>

        <dl className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
          {[
            { n: fmt(s.tracked), label: 'programs tracked' },
            { n: fmt(s.verifiedLive), label: 'checked against the official page and open to claim' },
            { n: String(s.states), label: 'states with programs of their own' },
          ].map((x) => (
            <div key={x.label} className="rounded-2xl border border-border p-5 text-center">
              <dt className="sr-only">{x.label}</dt>
              <dd>
                <span className="block font-display text-4xl font-semibold text-ink">{x.n}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{x.label}</span>
              </dd>
            </div>
          ))}
        </dl>

        <ul className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-3">
          {rows.map((r) => (
            <li key={r.goal} className="space-y-1.5 rounded-2xl bg-off-white p-5">
              <p className="font-semibold text-ink">{r.title}</p>
              <p className="text-sm text-muted-foreground">{fmt(s.byGoal[r.goal])} verified programs</p>
              {r.sample && (
                <p className="text-sm text-ink">
                  For example, {r.sample.name} ({r.sample.where}): {r.sample.amount.charAt(0).toLowerCase()}
                  {r.sample.amount.slice(1)}.
                </p>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-10 text-center">
          <TrackedLink href={MARKET_REALITY_START_HREF} event="funding_cta_clicked" properties={{ cta: 'join_for_matches', page: 'home' }} className={action}>
            Join free and see what you qualify for
          </TrackedLink>
          <p className="mt-3 text-sm text-muted-foreground">
            Free for candidates, always.{' '}
            <Link href="/funding" className="font-medium text-brand underline underline-offset-4">
              See what is inside
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
