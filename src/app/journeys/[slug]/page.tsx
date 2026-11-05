import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { H2, LINK, SeoPage, Stat } from '@/components/seo/SeoPage'
import { AuthorByline } from '@/components/seo/AuthorByline'
import { NewsFeed } from '@/components/news/NewsFeed'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { articleJsonLd } from '@/lib/seo/jsonld'
import { pageH1, pageMetadata, pageSeo } from '@/lib/seo/keywords'
import { EMPLOYEE_JOURNEYS, getEmployeeJourney, type EmployeeJourney } from '@/lib/journeys/employee-journeys'
import { getPublishedNewsByTag } from '@/lib/news/published'
import { getPayVsPrices } from '@/lib/market/bls-pay'

// News and BLS figures change daily; publishing in the admin or a BLS release shows within minutes without a rebuild.
export const revalidate = 300

export function generateStaticParams() {
  return EMPLOYEE_JOURNEYS.map((j) => ({ slug: j.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  if (!getEmployeeJourney(slug)) return {}
  const base = pageMetadata(`/journeys/${slug}`)
  return { ...base, openGraph: { ...base.openGraph, type: 'article' } }
}

const signed = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}%`
const monthName = (year: number, month: number) =>
  new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })

async function PayData() {
  const d = await getPayVsPrices()
  if (!d) {
    return <p className="mt-3 text-base text-muted-foreground">The Bureau of Labor Statistics figures could not be loaded just now. Check back shortly.</p>
  }
  const verdict = d.realPct >= 0 ? 'Pay is ahead of prices' : 'Prices are ahead of pay'
  return (
    <>
      <ul className="mt-4 grid gap-4 sm:grid-cols-3">
        <Stat value={signed(d.wagesPct)} label="Average hourly earnings, last 12 months" note="All private-sector employees" />
        <Stat value={signed(d.pricesPct)} label="Consumer prices, last 12 months" note="CPI-U, all items" />
        <Stat value={`${d.realPct >= 0 ? '+' : '−'}${Math.abs(d.realPct).toFixed(1)} pts`} label={verdict} note="Pay change minus price change" />
      </ul>
      <p className="mt-3 text-sm text-muted-foreground">
        Bureau of Labor Statistics, {monthName(d.year, d.month)}, seasonally adjusted. These are national averages for all workers, not white-collar roles or your city.
      </p>
    </>
  )
}

async function JourneyNews({ j }: { j: EmployeeJourney }) {
  const items = await getPublishedNewsByTag(j.tag, 12)
  return items.length === 0 ? (
    <p className="mt-4 rounded-xl border border-dashed border-border bg-white p-6 text-muted-foreground">
      No stories on this yet. New ones appear here as they are published; the <Link href="/news" className={LINK}>news page</Link> has everything so far.
    </p>
  ) : (
    <div className="mt-4">
      <NewsFeed items={items} placement={`journey-${j.slug}`} />
      <p className="mt-4 text-sm">
        <TrackedLink href={`/news?topic=${j.tag}`} event="journey_news_all_clicked" properties={{ journey: j.slug, tag: j.tag }} className={LINK}>
          See every story on this topic
        </TrackedLink>
      </p>
    </div>
  )
}

export default async function JourneyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const j = getEmployeeJourney(slug)
  if (!j) notFound()
  const path = `/journeys/${j.slug}`
  const h1 = pageH1(path, j.h1)
  return (
    <SeoPage
      trail={[{ name: 'Journeys', path: '/journeys' }, { name: j.label, path }]}
      h1={h1}
      lede={j.lede}
      jsonLd={[articleJsonLd({ headline: h1, path, description: pageSeo(path).description, dateModified: j.updated })]}
      boxFirst
      ask={{ ...j.ask, situation: j.situation, journey: j.slug }}
    >
      <AuthorByline updated={j.updated} className="mt-3" />
      <div className="mt-10 max-w-3xl space-y-10">
        <section>
          <h2 className={H2}>Signs this is you</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-base leading-relaxed text-foreground">
            {j.signs.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </section>
      </div>

      <section className="mt-10" aria-labelledby="journey-news">
        <h2 id="journey-news" className={H2}>In the news</h2>
        <JourneyNews j={j} />
      </section>

      {j.data === 'pay' && (
        <section className="mt-10 max-w-4xl" aria-labelledby="journey-data">
          <h2 id="journey-data" className={H2}>The numbers</h2>
          <PayData />
        </section>
      )}

      <div className="mt-10 grid max-w-4xl gap-6 sm:grid-cols-2">
        <section aria-labelledby="journey-favor">
          <h2 id="journey-favor" className={H2}>In your favor</h2>
          <ul className="mt-3 space-y-4">
            {j.inYourFavor.map((p) => (
              <li key={p.h}><h3 className="font-medium text-foreground">{p.h}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.p}</p></li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="journey-watch">
          <h2 id="journey-watch" className={H2}>Watch for</h2>
          <ul className="mt-3 space-y-4">
            {j.watchFor.map((p) => (
              <li key={p.h}><h3 className="font-medium text-foreground">{p.h}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.p}</p></li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-10 max-w-3xl" aria-labelledby="journey-next">
        <h2 id="journey-next" className={H2}>Go deeper</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-base">
          {j.next.map((n) => (
            <li key={n.href}>
              <TrackedLink href={n.href} event="journey_link_clicked" properties={{ journey: j.slug, href: n.href }} className={LINK}>{n.label}</TrackedLink>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted-foreground">
          Other journeys:{' '}
          {EMPLOYEE_JOURNEYS.filter((o) => o.slug !== j.slug).map((o, i) => (
            <span key={o.slug}>{i > 0 && ', '}<Link href={`/journeys/${o.slug}`} className={LINK}>{o.label}</Link></span>
          ))}
        </p>
      </section>
    </SeoPage>
  )
}
