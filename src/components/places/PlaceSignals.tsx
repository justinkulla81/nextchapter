import Link from 'next/link'
import { getPlaceNews, getPlaceSignals } from '@/lib/places/signals'
import { H2, LINK } from '@/components/seo/SeoPage'

const day = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

/**
 * Outlook, news and learning for a place: built from public figures (BLS, Census) and the latest area news from the
 * workforce boards that serve it. Renders nothing it has no data for. Headline, publisher, date and link only.
 */
export async function PlaceSignals({ scope, outlookScope, fips, boardIds, workforceHref }: { scope: string; outlookScope?: string; fips: string[]; boardIds: string[]; workforceHref?: string }) {
  const [signals, news] = await Promise.all([getPlaceSignals(fips).catch(() => null), getPlaceNews(boardIds).catch(() => [])])
  const o = signals?.outlook
  const ctx = signals?.context
  const showOutlook = !!o && o.label !== 'Not enough data'
  const sectors = (list: { label: string; change: number }[]) => list.map((s) => `${s.label.toLowerCase()} (${s.change > 0 ? '+' : '−'}${Math.abs(s.change).toLocaleString('en-US')} jobs)`).join(', ')
  return (
    <>
      {showOutlook && o && (
        <section aria-labelledby="outlook" className="mt-12">
          <h2 id="outlook" className={H2}>{outlookScope ?? scope} outlook: {o.label}</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Built from public Bureau of Labor Statistics and Census figures. It describes the area, not any one employer in it.</p>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {o.evidence.map((x) => <li key={x}>{x}</li>)}
            {ctx && ctx.growing.length > 0 && <li>Sectors adding the most jobs: {sectors(ctx.growing)}</li>}
            {ctx && ctx.shrinking.length > 0 && <li>Sectors losing the most jobs: {sectors(ctx.shrinking)}</li>}
          </ul>
        </section>
      )}
      {news.length > 0 && (
        <section aria-labelledby="news" className="mt-12">
          <h2 id="news" className={H2}>Local job-market news</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Recent headlines about layoffs, AI and jobs in {scope}. Each link goes to the publisher.</p>
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-white text-sm">
            {news.map((n) => (
              <li key={n.url} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
                <a href={n.url} rel="nofollow noopener" target="_blank" className={LINK}>{n.title}</a>
                <span className="text-xs text-muted-foreground">{[n.publisher, n.publishedAt ? day(n.publishedAt) : null].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="learn" className="mt-12">
        <h2 id="learn" className={H2}>Learn and get funded in {scope}</h2>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
          <li><Link href="/ai-skills" className={LINK}>Which AI skills each kind of job asks for</Link>, with the pay premium.</li>
          {workforceHref && <li><Link href={workforceHref} className={LINK}>Your local workforce board and American Job Centers</Link>: training vouchers and re-employment help.</li>}
          <li><Link href="/funding" className={LINK}>Grants and funding for job seekers</Link>, ranked for your state and situation.</li>
          <li><Link href="/unemployment-benefits" className={LINK}>Unemployment benefits</Link> by state, if you are between jobs.</li>
        </ul>
      </section>
    </>
  )
}
