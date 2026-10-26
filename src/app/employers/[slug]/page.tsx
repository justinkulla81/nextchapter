import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SeoPage, H2, LINK, Stat, ActionBand } from '@/components/seo/SeoPage'
import { canonical } from '@/lib/seo/canonical'
import { getEmployerBySlug, type EmployerPage } from '@/lib/seo/employer-pages'
import { SITE_URL } from '@/lib/seo/facts'
import { stateName } from '@/lib/seo/states'
import { bucketFromIndustryText, functionByName, functionPath, industryPath } from '@/lib/seo/topics'

// One page per employer with something of its own to say: open roles from its career site, what it hires for and
// pays. Built on first visit, refreshed daily. A page below the bar renders but is
// kept out of search results (and out of the sitemap).
export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

const n0 = (n: number) => n.toLocaleString('en-US')
const pct = (x: number) => `${Math.round(x * 100)}%`
const stateLabel = (code: string | null) => (code ? (stateName(code) ?? code) : '')

const PAY_LEVEL: Record<string, string> = {
  high: 'above the market range for the same roles',
  in_line: 'in line with the market range for the same roles',
  low: 'below the market range for the same roles',
}

function title(e: EmployerPage): string {
  const bits: string[] = []
  if (e.profile && e.profile.openNow > 0) bits.push('jobs')
  bits.push('pay')
  return `${e.name} ${bits.join(', ')}: ${e.profile && e.profile.openNow > 0 ? `${n0(e.profile.openNow)} open roles` : 'hiring and pay'}`
}

function description(e: EmployerPage): string {
  const parts: string[] = []
  const p = e.profile
  if (p && p.openNow > 0) {
    const fn = p.topFunctions[0]?.function
    parts.push(`${e.name} has ${n0(p.openNow)} open professional roles${fn ? `, most in ${fn.toLowerCase()}` : ''}`)
    if (p.opened90d > 0) parts.push(`${n0(p.opened90d)} opened in the last 90 days`)
  }
  return `${parts.join('; ')}. Posted pay, where it hires and how to apply.`.replace(/^./, (c) => c.toUpperCase())
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const e = await getEmployerBySlug(slug)
  if (!e || !e.profile) return {}
  return {
    title: title(e),
    description: description(e),
    ...canonical(`/employers/${slug}`),
    ...(e.indexable ? {} : { robots: { index: false, follow: true } }),
  }
}

export default async function EmployerPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const e = await getEmployerBySlug(slug)
  if (!e || !e.profile) notFound()
  const p = e.profile
  const path = `/employers/${slug}`
  const hq = [e.hqMetro, e.industry].filter(Boolean).join(' · ')
  const industryBucket = bucketFromIndustryText(e.industry)
  const topFunction = p?.topFunctions[0] ? functionByName(p.topFunctions[0].function) : null

  const faq: { q: string; a: string }[] = []
  if (p && p.openNow > 0) {
    faq.push({
      q: `Is ${e.name} hiring?`,
      a: `${e.name} has ${n0(p.openNow)} open professional roles on its career site as of the last check. ${p.opened90d > 0 ? `${n0(p.opened90d)} opened in the last 90 days and ${n0(p.opened12mo)} in the last 12 months.` : ''}${p.topFunctions[0] ? ` The most common function is ${p.topFunctions[0].function.toLowerCase()}.` : ''}`.trim(),
    })
  }
  if (p && p.payLevel in PAY_LEVEL && p.payLevelSample >= 5) {
    faq.push({ q: `How well does ${e.name} pay?`, a: `Across ${n0(p.payLevelSample)} postings with a posted salary range, ${e.name}'s pay is ${PAY_LEVEL[p.payLevel]}. We compare each posted range with the market range for the same title, function and area.` })
  }

  const ld: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${SITE_URL}${path}#org`,
      name: e.name,
      ...(e.website ? { url: e.website } : {}),
    },
    ...(faq.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }] : []),
  ]

  return (
    <SeoPage
      trail={[{ name: 'Employers', path: '/employers' }, { name: e.name, path }]}
      h1={`${e.name}: jobs and pay`}
      jsonLd={ld}
      lede={<>{hq && <span className="block text-sm">{hq}</span>}{(industryBucket || topFunction) && <span className="block text-sm">Explore: {industryBucket && <a href={industryPath(industryBucket)} className="underline underline-offset-2">{industryBucket}</a>}{industryBucket && topFunction && ' · '}{topFunction && <a href={functionPath(topFunction.name)} className="underline underline-offset-2">{topFunction.name} jobs</a>}</span>}{description(e)}</>}
    >
      {p && p.openNow > 0 && (
        <section aria-labelledby="hiring" className="mt-10">
          <h2 id="hiring" className={H2}>Hiring now</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat value={n0(p.openNow)} label="open professional roles" />
            <Stat value={n0(p.opened90d)} label="opened in the last 90 days" note={`${n0(p.opened12mo)} in the last 12 months`} />
            {p.remoteShare != null && <Stat value={pct(p.remoteShare)} label="of roles are remote" />}
            {p.states.length > 0 && <Stat value={n0(p.states.length)} label={p.states.length === 1 ? 'state hiring' : 'states hiring'} note={p.states.slice(0, 6).map(stateLabel).join(', ')} />}
          </ul>
          {p.topFunctions.length > 0 && (
            <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
              <span className="font-medium text-foreground">What it hires for:</span>{' '}
              {p.topFunctions.slice(0, 5).map((f) => `${f.function} (${n0(f.count)})`).join(', ')}.
              {p.levelMix.length > 0 && <> <span className="font-medium text-foreground">By level:</span> {p.levelMix.slice(0, 5).map((l) => `${l.group.replace(/_/g, ' ').toLowerCase()} (${n0(l.count)})`).join(', ')}.</>}
            </p>
          )}
          {p.topLocations.length > 0 && (
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Where:</span> {p.topLocations.slice(0, 6).map((l) => `${l.location} (${n0(l.count)})`).join(', ')}.
            </p>
          )}
        </section>
      )}

      {e.jobs.length > 0 && (
        <section aria-labelledby="roles" className="mt-12">
          <h2 id="roles" className={H2}>Open roles</h2>
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-white text-sm">
            {e.jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-baseline justify-between gap-2 p-4">
                <Link href={`/jobs/${j.id}`} className={`${LINK} font-medium`}>{j.title}</Link>
                <span className="text-xs text-muted-foreground">{[j.location, j.pay].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm"><Link href={`/jobs?q=${encodeURIComponent(e.name)}`} className={LINK}>Search all {e.name} jobs</Link></p>
        </section>
      )}

      {(e.pay.length > 0 || (p && p.payLevel in PAY_LEVEL && p.payLevelSample >= 5)) && (
        <section aria-labelledby="pay" className="mt-12">
          <h2 id="pay" className={H2}>What {e.name} pays</h2>
          {p && p.payLevel in PAY_LEVEL && p.payLevelSample >= 5 && (
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Across {n0(p.payLevelSample)} postings with a posted range, pay is {PAY_LEVEL[p.payLevel]}.
              {p.postedPayShare != null && <> {pct(p.postedPayShare)} of its roles post a salary range.</>}
            </p>
          )}
          {e.pay.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <caption className="sr-only">Posted pay ranges at {e.name}</caption>
                <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
                  <tr><th scope="col" className="p-3">Level</th><th scope="col" className="p-3">Function</th><th scope="col" className="p-3">Typical posted range</th><th scope="col" className="p-3">Postings</th></tr>
                </thead>
                <tbody>
                  {e.pay.map((g) => (
                    <tr key={`${g.level}|${g.function}`} className="border-b border-border last:border-0">
                      <td className="p-3">{g.level}</td><td className="p-3">{g.function ?? 'Various'}</td>
                      <td className="p-3 tabular-nums">${n0(g.medianMin)}–${n0(g.medianMax)}</td><td className="p-3 tabular-nums">{g.postings}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Only salary ranges the employer posted. No estimates.</p>
        </section>
      )}

      {faq.length > 0 && (
        <section aria-labelledby="faq" className="mt-12">
          <h2 id="faq" className={H2}>Common questions</h2>
          <dl className="mt-4 max-w-3xl space-y-4 text-sm">
            {faq.map((f) => (<div key={f.q}><dt className="font-medium text-navy">{f.q}</dt><dd className="mt-1 text-muted-foreground">{f.a}</dd></div>))}
          </dl>
        </section>
      )}

      <ActionBand
        title={`Work at ${e.name}?`}
        body={`Claim this page and set up a free workspace for ${e.name}. Use a work email at your company’s domain.`}
        label="Claim this page"
        href={e.claimSlug ? `/prepared/${e.claimSlug}` : '/for-organizations'}
        event="seo_claim_clicked"
        properties={{ page: 'employer', audience: 'employer', companyId: e.id, slug: e.slug, openRoles: p?.openNow ?? 0 }}
      />

      <p className="mt-8 max-w-3xl text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Sources:</span> open roles from {e.name}’s career site and applicant system, checked daily;
        market pay ranges from posted salaries across the board. Updated {p?.firstSeenAt ? 'daily' : 'regularly'}.
      </p>
    </SeoPage>
  )
}
