import Link from 'next/link'
import { H2, LINK } from '@/components/seo/SeoPage'
import { getPlaceRanks } from '@/lib/rankings/store'

/** "Where this place ranks": the monthly rankings it is in the top 25 of, linked. Renders nothing when it is in none. */
export async function PlaceRanks({ placeKey, scope }: { placeKey: string; scope: string }) {
  const ranks = await getPlaceRanks(placeKey)
  if (!ranks.length) return null
  return (
    <section aria-labelledby="ranks" className="mt-12">
      <h2 id="ranks" className={H2}>Where {scope} ranks</h2>
      <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {ranks.map((r) => (
          <li key={r.slug}>
            <span className="font-semibold tabular-nums text-navy">#{r.rank}</span>{' '}
            <Link href={`/rankings/${r.slug}`} className={LINK}>{r.title}</Link>{' '}
            <span className="text-xs text-muted-foreground">{r.valueLabel}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm"><Link href="/rankings" className={LINK}>All monthly rankings</Link></p>
    </section>
  )
}
