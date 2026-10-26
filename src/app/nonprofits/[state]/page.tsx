import type { Metadata } from 'next'
import { emptyStateOrNotFound } from '@/lib/seo/empty-state'
import Link from 'next/link'
import { SeoPage, H2, LINK, Stat, ActionBand } from '@/components/seo/SeoPage'
import { canonical } from '@/lib/seo/canonical'
import { stateFromSlug, stateName } from '@/lib/seo/states'
import { NONPROFIT_KINDS, getNonprofitFunding, getStateNonprofits, money } from '@/lib/seo/nonprofit-pages'
import { getStateBoards, getStateLabor, periodLabel, rateText } from '@/lib/seo/workforce-pages'

export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

async function load(slug: string) {
  const code = stateFromSlug(slug)
  if (!code) return null
  const orgs = await getStateNonprofits(code)
  if (orgs.length === 0) return null
  const [labor, funding, boards] = await Promise.all([getStateLabor(code), getNonprofitFunding(code), getStateBoards(code)])
  return { code, name: stateName(code), orgs, labor, funding, boards }
}

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  const { state } = await params
  const d = await load(state)
  if (!d) return {}
  return {
    title: `${d.name} nonprofits: chambers, economic development and workforce organizations`,
    description: `${d.orgs.length} larger ${d.name} nonprofits from IRS records, the ${d.name} labor market, grants open to nonprofits, and local workforce boards.`,
    ...canonical(`/nonprofits/${state}`),
  }
}

export default async function NonprofitStatePage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  const d = await load(state)
  if (!d) emptyStateOrNotFound(state, '/nonprofits')
  const byKind = Object.keys(NONPROFIT_KINDS).map((k) => ({ k, orgs: d.orgs.filter((o) => o.kind === k) })).filter((g) => g.orgs.length > 0)

  return (
    <SeoPage
      trail={[{ name: 'Nonprofits', path: '/nonprofits' }, { name: d.name, path: `/nonprofits/${state}` }]}
      h1={`${d.name} nonprofits: chambers, economic development and workforce organizations`}
      lede={<>{d.orgs.length} {d.name} nonprofits with $1 million or more in annual revenue, from IRS records, and what is happening in the {d.name} job market around them. Staff can claim an organization’s page and set up a free workspace.</>}
    >
      <section aria-labelledby="stats" className="mt-10">
        <h2 id="stats" className={H2}>What matters to {d.name} nonprofits right now</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {d.labor && <Stat value={rateText(d.labor)} label={`unemployment, ${periodLabel(d.labor.period)}`} note="BLS, counties summed" />}
          <Stat value={d.funding.length.toLocaleString()} label="open grants for nonprofits" note="Grants.gov and SAM.gov" />
          <Stat value={d.boards.length.toLocaleString()} label="local workforce boards" />
        </ul>
        <p className="mt-3 text-sm">
          <Link href={`/workforce-boards/${state}`} className={LINK}>{d.name} workforce boards</Link> · <Link href={`/economic-development/${state}`} className={LINK}>{d.name} economic development organizations</Link> · <Link href="/reports/white-collar-employment-report-september-2026" className={LINK}>White Collar Employment Report</Link>
        </p>
      </section>

      {d.funding.length > 0 && (
        <section aria-labelledby="funding" className="mt-12">
          <h2 id="funding" className={H2}>Grants open to {d.name} nonprofits</h2>
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-white text-sm">
            {d.funding.map((f) => (
              <li key={f.id} className="p-4">
                <a href={f.url} className={`${LINK} font-medium`} target="_blank" rel="noopener noreferrer">{f.title}</a>
                <p className="mt-1 text-xs text-muted-foreground">{[f.agency, f.closesAt ? `closes ${f.closesAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : null, f.awardCeiling ? `up to ${money(f.awardCeiling)}` : null].filter(Boolean).join(' · ')}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {byKind.map((g) => (
        <section key={g.k} aria-labelledby={`k-${g.k}`} className="mt-12">
          <h2 id={`k-${g.k}`} className={H2}>{NONPROFIT_KINDS[g.k].plural}</h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <caption className="sr-only">{NONPROFIT_KINDS[g.k].plural} in {d.name}, largest first</caption>
              <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
                <tr><th scope="col" className="p-3">Organization</th><th scope="col" className="p-3">City</th><th scope="col" className="p-3">Annual revenue</th></tr>
              </thead>
              <tbody>
                {g.orgs.slice(0, 40).map((o) => (
                  <tr key={o.ein} className="border-b border-border last:border-0">
                    <td className="p-3"><Link href={`/nonprofits/${state}/${o.slug}`} className={LINK}>{o.name}</Link></td>
                    <td className="p-3">{o.city ?? ''}</td>
                    <td className="p-3 tabular-nums">{o.revenue ? money(o.revenue) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {g.orgs.length > 40 && <p className="mt-2 text-xs text-muted-foreground">Largest 40 of {g.orgs.length}.</p>}
        </section>
      ))}

      <ActionBand
        title={`Run a ${d.name} nonprofit?`}
        body="Claim your organization’s page and set up a free workspace. Use a work email at your organization’s domain."
        label="See how a nonprofit claims its page"
        href="/nonprofits#claim"
        event="seo_claim_clicked"
        properties={{ page: 'nonprofit_state', audience: 'nonprofit', state: d.code }}
      />
      <p className="mt-10 max-w-3xl text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Sources:</span> organization names, cities, revenue and filing years from IRS tax-exempt organization records; unemployment from the Bureau of Labor Statistics;
        grants from Grants.gov and SAM.gov.
      </p>
    </SeoPage>
  )
}
