import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK, ActionBand } from '@/components/seo/SeoPage'
import { canonical } from '@/lib/seo/canonical'
import { prisma } from '@/lib/prisma'
import { stateName, stateSlug } from '@/lib/seo/states'

export const revalidate = 86400

export const metadata: Metadata = {
  title: 'Economic development organizations and districts by state',
  description: 'State economic development agencies, economic development districts and local organizations, by state, with each state’s labor market and layoff picture.',
  ...canonical('/economic-development'),
}

export default async function EconomicDevelopmentHubPage() {
  const rows = await prisma.localPartnerOrg.groupBy({ by: ['state'], where: { OR: [{ confidence: null }, { confidence: { not: 'low' } }] }, _count: { _all: true } })
  const states = rows.filter((r) => { try { return !!stateName(r.state) && stateSlug(r.state) } catch { return false } }).sort((a, b) => stateName(a.state).localeCompare(stateName(b.state)))
  const total = states.reduce((s, r) => s + r._count._all, 0)
  return (
    <SeoPage
      trail={[{ name: 'Economic development', path: '/economic-development' }]}
      h1="Economic development organizations and districts"
      lede={<>{total.toLocaleString()} state agencies, economic development districts and local organizations across {states.length} states. Pick a state to see its organizations and its labor market.</>}
    >
      <section aria-labelledby="states" className="mt-10">
        <h2 id="states" className={H2}>Browse by state</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {states.map((s) => (
            <li key={s.state} className="rounded-xl border border-border bg-white p-4 text-sm">
              <Link href={`/economic-development/${stateSlug(s.state)}`} className={`${LINK} font-medium`}>{stateName(s.state)}</Link>
              <p className="mt-1 text-xs text-muted-foreground">{s._count._all} {s._count._all === 1 ? 'organization' : 'organizations'}</p>
            </li>
          ))}
        </ul>
      </section>
      <ActionBand
        title="Run an economic development organization?"
        body="Claim your organization’s page and set up a free workspace. Use a work email at your organization’s domain."
        label="See how an organization claims its page"
        href="/government-workforce#claim"
        event="seo_claim_clicked"
        properties={{ page: 'economic_development_hub', audience: 'economic_development' }}
      />
    </SeoPage>
  )
}
