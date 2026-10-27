import { absoluteWebUrl } from '@/lib/http/external-url'
import type { Metadata } from 'next'
import { LinkToUs } from '@/components/seo/LinkToUs'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SeoPage, H2, LINK, Stat, ActionBand } from '@/components/seo/SeoPage'
import { canonical } from '@/lib/seo/canonical'
import { stateFromSlug, stateName } from '@/lib/seo/states'
import { NONPROFIT_KINDS, getNonprofit, getNonprofitFunding, money } from '@/lib/seo/nonprofit-pages'
import { getStateBoards, getStateLabor, periodLabel, rateText } from '@/lib/seo/workforce-pages'
import { STATE_FIGURES, STATE_FIGURES_EDITION } from '@/lib/report-state-figures'

// One page per nonprofit with $1 million or more in revenue, from its IRS record, set in its state's job market.
// A smaller organization's page renders but is kept out of search results and the sitemap.
export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Promise<{ state: string; org: string }> }): Promise<Metadata> {
  const { state, org } = await params
  const code = stateFromSlug(state)
  const o = code ? await getNonprofit(code, org) : null
  if (!o) return {}
  return {
    title: `${o.name}${o.city ? `, ${o.city}` : ''}: IRS record, local jobs picture and open grants`,
    description: `${o.name} is a ${NONPROFIT_KINDS[o.kind]?.label ?? 'nonprofit'} in ${o.city ? `${o.city}, ` : ''}${stateName(o.state)}${o.revenue ? ` with ${money(o.revenue)} in annual revenue` : ''}. The ${stateName(o.state)} labor market, open grants and workforce boards.`,
    ...canonical(`/nonprofits/${state}/${org}`),
    ...(o.indexable ? {} : { robots: { index: false, follow: true } }),
  }
}

export default async function NonprofitPage({ params }: { params: Promise<{ state: string; org: string }> }) {
  const { state, org } = await params
  const code = stateFromSlug(state)
  const o = code ? await getNonprofit(code, org) : null
  if (!code || !o) notFound()
  const [labor, funding, boards] = await Promise.all([getStateLabor(code), getNonprofitFunding(code), getStateBoards(code)])
  const name = stateName(code)
  const figures = STATE_FIGURES[code]
  const path = `/nonprofits/${state}/${org}`

  return (
    <SeoPage
      trail={[{ name: 'Nonprofits', path: '/nonprofits' }, { name, path: `/nonprofits/${state}` }, { name: o.name, path }]}
      h1={o.name}
      lede={<>A {NONPROFIT_KINDS[o.kind]?.label ?? 'nonprofit'}{o.city ? ` in ${o.city}, ${name}` : ` in ${name}`}{o.nteeGroup ? `, classified under ${o.nteeGroup.toLowerCase()}` : ''}.</>}
    >
      <section aria-labelledby="record" className="mt-10">
        <h2 id="record" className={H2}>IRS record</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-3">
          {o.revenue != null && <Stat value={money(o.revenue)} label="annual revenue" note={o.taxYear ? `tax year ${o.taxYear}` : undefined} />}
          {o.assets != null && <Stat value={money(o.assets)} label="total assets" />}
          {o.ntee && <Stat value={o.ntee} label="NTEE code" note={o.nteeGroup ?? undefined} />}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">EIN {o.ein}. From IRS tax-exempt organization records.</p>
      </section>

      <section aria-labelledby="market" className="mt-12">
        <h2 id="market" className={H2}>The {name} job market</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {labor && <Stat value={rateText(labor)} label={`unemployment, ${periodLabel(labor.period)}`} note="BLS, counties summed" />}
          {figures?.unemploymentRate != null && <Stat value={`${figures.unemploymentRate.toFixed(1)}%`} label={`state unemployment, ${STATE_FIGURES_EDITION.month}`} note="seasonally adjusted" />}
          {figures?.payrollChange && <Stat value={`${figures.payrollChange.jobs >= 0 ? '+' : '−'}${Math.abs(figures.payrollChange.jobs).toLocaleString()}`} label="jobs, over the year" note={STATE_FIGURES_EDITION.period} />}
        </ul>
        <p className="mt-3 text-sm">
          <Link href={`/reports/${STATE_FIGURES_EDITION.slug}`} className={LINK}>White Collar Employment Report</Link>
        </p>
      </section>

      {funding.length > 0 && (
        <section aria-labelledby="funding" className="mt-12">
          <h2 id="funding" className={H2}>Grants open to {name} nonprofits</h2>
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-white text-sm">
            {funding.slice(0, 5).map((f) => (
              <li key={f.id} className="p-4">
                <a href={absoluteWebUrl(f.url) ?? f.url} className={`${LINK} font-medium`} target="_blank" rel="noopener noreferrer">{f.title}</a>
                <p className="mt-1 text-xs text-muted-foreground">{[f.agency, f.closesAt ? `closes ${f.closesAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : null, f.awardCeiling ? `up to ${money(f.awardCeiling)}` : null].filter(Boolean).join(' · ')}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm"><Link href={`/nonprofits/${state}`} className={LINK}>More {name} nonprofits and grants</Link></p>
        </section>
      )}

      {boards.length > 0 && (
        <section aria-labelledby="boards" className="mt-12">
          <h2 id="boards" className={H2}>Workforce partners in {name}</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {boards.slice(0, 6).map((b) => (
              <li key={b.id} className="rounded-xl border border-border bg-white p-4 text-sm">
                <Link href={`/workforce-boards/${state}/${b.slug}`} className={`${LINK} font-medium`}>{b.name}</Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm"><Link href={`/workforce-boards/${state}`} className={LINK}>All {name} boards</Link> · <Link href={`/economic-development/${state}`} className={LINK}>{name} economic development organizations</Link></p>
        </section>
      )}

      <ActionBand
        title={`Work at ${o.name}?`}
        body={`Claim this page and set up a free workspace for ${o.name}. Use a work email at your organization’s domain.`}
        label="Claim this page"
        href={o.claimSlug ? `/prepared/${o.claimSlug}` : '/nonprofits#claim'}
        event="seo_claim_clicked"
        properties={{ page: 'nonprofit', audience: 'nonprofit', ein: o.ein, state: code, kind: o.kind }}
      />
      <p className="mt-10 max-w-3xl text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Sources:</span> IRS tax-exempt organization records; Bureau of Labor Statistics; Grants.gov and SAM.gov.
      </p>
      <LinkToUs path={path} name={o.name} kind="nonprofit" />
    </SeoPage>
  )
}
