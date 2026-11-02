import Link from 'next/link'
import { editionLabel } from '@/lib/rankings/build-edition'
import { readRankingIndex } from '@/lib/rankings/store'

const FEATURED = ['best-cities-for-junior-jobs', 'best-cities-for-ai-jobs', 'best-cities-for-pay-vs-cost-of-living', 'best-cities-for-software-engineering-jobs', 'fastest-growing-job-markets', 'best-cities-for-remote-jobs']

/** This month's rankings on the homepage: the leader of each, with a link in. Renders nothing until a ranking exists. */
export async function HomeRankings() {
  const index = await readRankingIndex().catch(() => [])
  const picks = FEATURED.map((s) => index.find((x) => x.slug === s)).filter((x): x is NonNullable<typeof x> => !!x).slice(0, 6)
  if (picks.length < 3) return null
  return (
    <section className="bg-white py-14" aria-labelledby="home-rankings">
      <div className="mx-auto max-w-5xl px-6">
        <h2 id="home-rankings" className="text-center text-2xl font-bold tracking-tight text-navy">Where the jobs are, ranked every month</h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-muted-foreground">{editionLabel(picks[0].edition)} rankings of cities and counties, with the data and method behind each.</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {picks.map((x) => (
            <li key={x.slug} className="rounded-xl border border-border bg-off-white p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{x.family}</p>
              <h3 className="mt-1 text-base font-semibold text-navy"><Link href={`/rankings/${x.slug}`} className="hover:underline">{x.title}</Link></h3>
              <p className="mt-2 text-sm text-foreground">#1 {x.topName}: {x.topValueLabel}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-center text-sm"><Link href="/rankings" className="text-brand underline underline-offset-4">See all rankings</Link></p>
      </div>
    </section>
  )
}
