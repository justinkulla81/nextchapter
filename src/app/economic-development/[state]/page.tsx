import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SeoPage, H2, LINK, Stat, ActionBand } from '@/components/seo/SeoPage'
import { canonical } from '@/lib/seo/canonical'
import { prisma } from '@/lib/prisma'
import { stateFromSlug, stateName } from '@/lib/seo/states'
import { getStateLabor, getStateLayoffs, periodLabel, rateText } from '@/lib/seo/workforce-pages'

export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

const KIND_LABEL: Record<string, string> = { STATE_AGENCY: 'State agency', EDD: 'Economic development district', LOCAL_EDO: 'Local economic development organization' }

async function load(slug: string) {
  const code = stateFromSlug(slug)
  if (!code) return null
  const orgs = await prisma.localPartnerOrg.findMany({
    where: { state: code, OR: [{ confidence: null }, { confidence: { not: 'low' } }] },
    select: { id: true, kind: true, name: true, city: true, countiesText: true, website: true },
    orderBy: [{ kind: 'asc' }, { name: 'asc' }],
  })
  if (orgs.length === 0) return null
  const [labor, layoffs] = await Promise.all([getStateLabor(code), getStateLayoffs(code)])
  return { code, name: stateName(code), orgs, labor, layoffs }
}

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  const { state } = await params
  const d = await load(state)
  if (!d) return {}
  return {
    title: `${d.name} economic development organizations and districts`,
    description: `${d.orgs.length} economic development agencies, districts and local organizations in ${d.name}, with the ${d.name} labor market and layoff picture they work in.`,
    ...canonical(`/economic-development/${state}`),
  }
}

export default async function EconomicDevelopmentStatePage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  const d = await load(state)
  if (!d) notFound()
  const kinds = Object.keys(KIND_LABEL).map((k) => ({ k, orgs: d.orgs.filter((o) => o.kind === k) })).filter((g) => g.orgs.length > 0)

  return (
    <SeoPage
      trail={[{ name: 'Economic development', path: '/economic-development' }, { name: d.name, path: `/economic-development/${state}` }]}
      h1={`${d.name} economic development organizations and districts`}
      lede={<>{d.orgs.length} economic development bodies in {d.name}: the state agency, economic development districts and local organizations. Staff can claim their organization’s page and set up a free workspace.</>}
    >
      <section aria-labelledby="market" className="mt-10">
        <h2 id="market" className={H2}>The {d.name} labor market</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-3">
          {d.labor && <Stat value={rateText(d.labor)} label={`unemployment, ${periodLabel(d.labor.period)}`} note="BLS, counties summed" />}
          <Stat value={d.layoffs.notices.toLocaleString()} label="WARN layoff notices, last 12 months" note={d.layoffs.workers > 0 ? `naming ${d.layoffs.workers.toLocaleString()} workers` : undefined} />
          <Stat value={d.orgs.length.toLocaleString()} label="organizations listed" />
        </ul>
        <p className="mt-3 text-sm"><Link href={`/layoffs/${state}`} className={LINK}>{d.name} layoff notices</Link> · <Link href={`/workforce-boards/${state}`} className={LINK}>{d.name} workforce boards</Link></p>
      </section>

      {kinds.map((g) => (
        <section key={g.k} aria-labelledby={`k-${g.k}`} className="mt-12">
          <h2 id={`k-${g.k}`} className={H2}>{KIND_LABEL[g.k]}s</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {g.orgs.map((o) => (
              <li key={o.id} className="rounded-xl border border-border bg-white p-4 text-sm">
                <p className="font-medium text-navy">{o.name.replace(/\s*\((listed by[^)]*|[A-Z]{2} DLG\/[^)]*)\)\s*$/i, '')}</p>
                <p className="mt-1 text-xs text-muted-foreground">{[o.city, o.countiesText].filter(Boolean).join(' · ')}</p>
                {o.website && /^https?:\/\//.test(o.website) && <a href={o.website} className={`${LINK} mt-1 inline-block text-xs`} target="_blank" rel="noopener noreferrer nofollow">Website</a>}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <ActionBand
        title={`Run an economic development organization in ${d.name}?`}
        body="Claim your organization’s page and set up a free workspace. Use a work email at your organization’s domain."
        label="See how an organization claims its page"
        href="/government-workforce#claim"
        event="seo_claim_clicked"
        properties={{ page: 'economic_development_state', audience: 'economic_development', state: d.code }}
      />
      <p className="mt-10 max-w-3xl text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Sources:</span> U.S. Economic Development Administration district list, state agency directories and each organization’s own listings; unemployment from the Bureau of Labor Statistics; layoff notices from {d.name}’s published WARN record.
      </p>
    </SeoPage>
  )
}
