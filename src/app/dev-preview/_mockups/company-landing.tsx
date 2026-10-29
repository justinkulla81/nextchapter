import Link from 'next/link'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { LandingHero } from '@/components/layoffs/landing/LandingHero'
import { SituationFlow } from '@/components/layoffs/landing/SituationFlow'
import { SearchTimeFacts } from '@/components/layoffs/landing/SearchTimeFacts'
import { PeerEmployers } from '@/components/layoffs/landing/PeerEmployers'
import type { LandingVariant } from '@/lib/layoffs/landing'
import { previewLead, previewSchools } from './company-landing-actions'

// The shared top of every company page (buyout, layoff and "changes at" versions), fed sample data. Notices and news sit last.

const H2 = 'text-2xl font-bold tracking-tight text-navy'
const LINK = 'text-brand underline underline-offset-4'

const NOTICES = [
  ['Sep 22, 2026', 'Redmond', '277', 'Nov 21, 2026'],
  ['Jul 6, 2026', 'Redmond', '605', 'Sep 4, 2026'],
  ['Nov 7, 2025', 'Redmond', '42', 'Nov 7, 2025'],
  ['Aug 1, 2025', 'Redmond', '305', 'Aug 1, 2025'],
  ['May 13, 2025', 'Redmond', '1,985', 'Jul 12, 2025'],
]

function Page({ variant, name, slug, workers, context, near, similar, metro, notices }: {
  variant: LandingVariant; name: string; slug: string; workers: number | null; context: React.ReactNode
  near: { name: string; href: string }[]; similar: { name: string; href: string }[]; metro: string | null; notices: boolean
}) {
  return (
    <div className="flex flex-1 flex-col">
      <PublicSiteHeader current="news" />
      <main className="flex-1 bg-off-white py-10">
        <div className="mx-auto max-w-6xl space-y-12 px-6">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <Link href="/layoffs" className="hover:text-foreground">Layoff tracker</Link><span aria-hidden> › </span><span className="text-foreground">{name}</span>
          </nav>
          <LandingHero variant={variant} name={name} slug={slug} latestWorkers={workers} context={context} />
          <SituationFlow variant={variant} company={name} slug={slug} state="WA" action={previewLead} searchSchools={previewSchools} />
          <SearchTimeFacts />
          <PeerEmployers company={name} near={near} similar={similar} metro={metro} />

          <details className="rounded-2xl border border-border bg-white">
            <summary className="cursor-pointer list-none p-5 font-semibold text-navy">
              {variant === 'buyout' ? `If you were offered the ${name} buyout: what to ask and when` : `If you were laid off by ${name}: what to ask and when`}
            </summary>
            <p className="px-5 pb-5 text-sm text-muted-foreground">The existing guide: questions to put in writing, scripts, filing for benefits, what to settle before your last day, agreements and programs near you.</p>
          </details>

          {notices && (
            <section aria-labelledby="notices">
              <h2 id="notices" className={H2}>Notices and news</h2>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Kept apart from the buyout report. A buyout is an offer and counts no one as laid off.</p>
              <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-3">Notice date</th><th className="p-3">City</th><th className="p-3 text-right">Workers</th><th className="p-3">Takes effect</th></tr></thead>
                  <tbody>{NOTICES.map((r) => <tr key={r[0]} className="border-t border-border"><td className="p-3">{r[0]}</td><td className="p-3">{r[1]}</td><td className="p-3 text-right tabular-nums">{r[2]}</td><td className="p-3">{r[3]}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          )}

          <p className="text-center text-sm text-muted-foreground">Want to browse openings on your own? <Link href="/jobs" className={LINK}>Go to the job board →</Link></p>
        </div>
      </main>
      <PublicSiteFooter page="layoffs" />
    </div>
  )
}

const MS_NEAR = ['Amazon', 'Boeing', 'T-Mobile', 'Expedia', 'Zillow'].map((n) => ({ name: n, href: '/jobs' }))
const MS_SIMILAR = ['Google', 'Apple', 'Salesforce', 'Oracle', 'Adobe'].map((n) => ({ name: n, href: '/jobs' }))

export function CompanyLandingBuyout() {
  return <Page variant="buyout" name="Microsoft" slug="microsoft" workers={277} metro="Seattle" near={MS_NEAR} similar={MS_SIMILAR} notices
    context="Reported Oct 26, 2026: voluntary buyouts offered to about 60,000 employees (Business Insider, unconfirmed). People still out of work in September had been looking for 25 weeks on average, so a week spent now is a week saved later." />
}
export function CompanyLandingLayout() {
  return <Page variant="layoff" name="Microsoft" slug="microsoft-layoff" workers={277} metro="Seattle" near={MS_NEAR} similar={MS_SIMILAR} notices
    context="Microsoft has filed 7 WARN notices with the Washington labor department, naming 4,084 workers. The most recent was filed Sep 22, 2026." />
}
export function CompanyLandingNeither() {
  return <Page variant="neither" name="Costco" slug="costco" workers={null} metro="Seattle" near={[{ name: 'Starbucks', href: '/jobs' }, { name: 'REI', href: '/jobs' }, { name: 'Nordstrom', href: '/jobs' }]} similar={[{ name: 'Target', href: '/jobs' }, { name: 'Walmart', href: '/jobs' }, { name: 'Kroger', href: '/jobs' }]} notices={false}
    context="Costco has no layoff or buyout on record with us. This page is for people thinking about their next move, with what is hiring nearby and elsewhere." />
}
