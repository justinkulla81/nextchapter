import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { LayoffTracker } from '@/components/news/LayoffTracker'
import { getLayoffTracker } from '@/lib/warn/public-tracker'
import { getStateSummaries } from '@/lib/warn/layoff-pages'
import { getNationalLaborData } from '@/lib/market/bls-national'
import { canonical } from '@/lib/seo/canonical'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'

export const revalidate = 86400

const DESCRIPTION =
  'WARN Act layoff notices filed with US state labor departments, collected daily: this year’s totals, the latest filings, and a page for every state and employer with a recent notice.'

export const metadata: Metadata = {
  title: 'Layoff tracker: WARN notices by state',
  description: DESCRIPTION,
  ...canonical('/layoffs'),
  openGraph: { title: 'NextChapter layoff tracker: WARN notices by state', description: DESCRIPTION, type: 'website' },
}

const LINK = 'text-brand underline underline-offset-4'

export default async function LayoffsHubPage() {
  const [tracker, national, states] = await Promise.all([getLayoffTracker(60), getNationalLaborData(), getStateSummaries().catch(() => [])])
  const withNotices = new Set(states.map((s) => s.state))
  const without = ALL_STATE_CODES.filter((c) => !withNotices.has(c))
  const byName = [...states].sort((a, b) => stateName(a.state).localeCompare(stateName(b.state)))

  return (
    <div className="flex flex-1 flex-col">
      <PublicSiteHeader current="news" />
      <main className="flex-1 bg-off-white py-12">
        <div className="mx-auto max-w-6xl px-6">
          {tracker ? (
            <LayoffTracker data={tracker} national={national} headingLevel="h1" />
          ) : (
            <>
              <h1 className="text-3xl font-bold tracking-tight text-navy">Layoff tracker</h1>
              <p className="mt-3 text-muted-foreground">The tracker could not be loaded right now. Please try again shortly.</p>
            </>
          )}

          <section aria-labelledby="by-state" className="mt-16">
            <h2 id="by-state" className="text-2xl font-bold tracking-tight text-navy">WARN notices by state</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              States with at least one notice in the last 12 months. Each page lists every notice with its source, the local
              workforce boards, and that state’s unemployment benefits.
            </p>
            {byName.length > 0 ? (
              <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {byName.map((s) => (
                  <li key={s.state}>
                    <Link href={`/layoffs/${stateSlug(s.state)}`} className="flex items-baseline justify-between rounded-lg border border-border bg-white px-4 py-3 text-sm hover:border-brand">
                      <span className="font-medium text-navy">{stateName(s.state)} layoffs</span>
                      <span className="tabular-nums text-muted-foreground">{s.recent.toLocaleString()} notices</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-6 text-sm text-muted-foreground">No state notices could be loaded right now.</p>
            )}
            {without.length > 0 && (
              <p className="mt-6 max-w-3xl text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Coverage note:</span> we have no WARN notices from the last 12
                months for {without.map(stateName).join(', ')}. Some of these states publish no notice list online, some
                publish in a form we cannot yet read, and some had no qualifying layoffs. Their{' '}
                <Link href="/unemployment-benefits" className={LINK}>unemployment benefits pages</Link> are still available.
              </p>
            )}
          </section>

          <section aria-labelledby="next" className="mt-16 rounded-xl border border-border bg-white p-6">
            <h2 id="next" className="text-xl font-semibold tracking-tight text-navy">If you’ve been laid off</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
              <li><Link href="/start/laid-off" className={LINK}>What to do after a layoff</Link></li>
              <li><Link href="/unemployment-benefits" className={LINK}>Unemployment benefits by state</Link></li>
              <li><Link href="/resources/72-hours" className={LINK}>The first 72 hours after a layoff</Link></li>
              <li><Link href="/resources/cobra-aca" className={LINK}>COBRA and marketplace health coverage</Link></li>
            </ul>
          </section>
        </div>
      </main>
      <PublicSiteFooter page="layoffs" />
    </div>
  )
}
