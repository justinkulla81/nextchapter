import { LocalEventSection } from '@/components/events/LocalEventSection'
import { getEmployerBrand } from '@/lib/branding/store'
import { OrgBrandScope } from '@/components/branding/OrgBrandScope'
import { OrgCandidateBand } from '@/components/seo/OrgCandidateBand'
import { LinkToUs } from '@/components/seo/LinkToUs'
import { employerSeo, fitDescription } from '@/lib/seo/templates'
import { ClaimHint } from '@/components/seo/ClaimHint'
import { hiringPlaces, listOf } from '@/lib/seo/employer-locations'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SituationFlow } from '@/components/layoffs/landing/SituationFlow'
import { searchSchools } from '@/lib/layoffs/landing-actions'
import { submitJourneyLead } from '@/lib/leads/actions'
import { SeoPage, H2, LINK, Stat, ActionBand } from '@/components/seo/SeoPage'
import { canonical } from '@/lib/seo/canonical'
import { getEmployerBySlug, type EmployerPage } from '@/lib/seo/employer-pages'
import { SITE_URL } from '@/lib/seo/facts'
import { getEmployerInsights } from '@/lib/seo/employer-insights'
import { insightText } from '@/lib/seo/employer-insight-text'
import { EmployerInsights } from '@/components/seo/EmployerInsights'
import { stateName } from '@/lib/seo/states'
import { sortConferences } from '@/lib/seo/topic-data'
import { conferencesForEmployer } from '@/lib/events/conference-employers'
import { prisma } from '@/lib/prisma'
import { SaveSearchForm } from '@/components/home/SaveSearchForm'
import { EmployerFollowBox } from '@/components/seo/EmployerFollowBox'
import { bucketFromIndustryText, functionByName, functionPath, industryPath } from '@/lib/seo/topics'
import { titleMeta } from '@/lib/seo/title'
import { AreaNotices } from '@/components/seo/AreaNotices'
import { CompanyEvents } from '@/components/seo/CompanyEvents'
import { eventsForCompanyIds } from '@/lib/events/sec-events'
import { noticesForEmployer } from '@/lib/seo/org-notices'

// One page per employer with something of its own to say: open roles from its career site, what it hires for and
// pays. Built on first visit, refreshed daily. A page below the bar renders but is
// kept out of search results (and out of the sitemap).
export const revalidate = 604800 // 7 days: second-largest source of ISR writes
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
  return employerSeo(e.name, e.profile?.openNow ?? null).title
}

function description(e: EmployerPage): string {
  const parts: string[] = []
  const p = e.profile
  if (p && p.openNow > 0) {
    const fn = p.topFunctions[0]?.function
    parts.push(`${e.name} has ${n0(p.openNow)} open professional roles${fn ? `, most in ${fn.toLowerCase()}` : ''}`)
    if (p.opened90d > 0) parts.push(`${n0(p.opened90d)} opened in the last 90 days`)
  }
  if (parts.length === 0) return `${e.name}: open roles, posted pay and hiring history from its career site, updated daily.`
  // The places it hires, by name: people search "<employer> <city>" (Search Console, 2026-10: "carvana fairfield ct", "qxo myrtle beach").
  const places = hiringPlaces(p?.topLocations ?? [], 3)
  const where = places.length ? ` Hiring in ${listOf(places)}.` : ''
  return fitDescription(`${parts.join('; ')}.${where} Posted pay, hiring history and how to apply.`.replace(/^./, (c) => c.toUpperCase()))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const e = await getEmployerBySlug(slug)
  if (!e) return {}
  return {
    title: titleMeta(title(e)),
    description: description(e),
    ...canonical(`/employers/${slug}`),
    ...(e.indexable ? {} : { robots: { index: false, follow: true } }),
  }
}

export default async function EmployerPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const e = await getEmployerBySlug(slug)
  if (!e) notFound()
  const p = e.profile
  const path = `/employers/${slug}`
  const ins = await getEmployerInsights(e.id, e.industry, { postedPayShare: e.profile?.postedPayShare ?? null, remoteShare: e.profile?.remoteShare ?? null }).catch(() => null)
  const text = ins ? insightText(e.name, ins, e.industry) : { glance: [], faq: [] }
  const hq = [e.hqMetro, e.industry].filter(Boolean).join(' · ')
  const industryBucket = bucketFromIndustryText(e.industry)
  const seenAt = await conferencesForEmployer(e.name)
  const layoffs = await noticesForEmployer(e.name).catch(() => null)
  const secEvents = await eventsForCompanyIds([e.id], 12, 8).catch(() => [])
  // Soonest first: events with upcoming confirmed dates, then the rest by name. The whole list is shown (an employer rarely appears at more than a few dozen).
  const seenAll = seenAt.length ? await prisma.conferenceEvent.findMany({ where: { id: { in: seenAt.map((x) => x.id) }, published: true }, select: { id: true, name: true, startDate: true, endDate: true, datesConfirmed: true, importance: true } }).catch(() => []) : []
  const seenConfs = sortConferences(seenAll)
  const topFunction = p?.topFunctions[0] ? functionByName(p.topFunctions[0].function) : null
  // The employer's own colors, read from its website (src/lib/branding), when we have them.
  const brand = await getEmployerBrand(e.name)

  const faq: { q: string; a: string }[] = []
  if (p && p.openNow > 0) {
    faq.push({
      q: `Is ${e.name} hiring?`,
      a: `${e.name} has ${n0(p.openNow)} open professional roles on its career site as of the last check. ${p.opened90d > 0 ? `${n0(p.opened90d)} opened in the last 90 days and ${n0(p.opened12mo)} in the last 12 months.` : ''}${p.topFunctions[0] ? ` The most common function is ${p.topFunctions[0].function.toLowerCase()}.` : ''}`.trim(),
    })
  }
  if (!p || p.openNow === 0) {
    faq.push({
      q: `Is ${e.name} hiring?`,
      a: `${e.name} has no open professional roles on its career site as of the last check.${p && p.opened12mo > 0 ? ` It opened ${n0(p.opened12mo)} in the last 12 months.` : ''} This page updates daily.`,
    })
  }
  if (p && p.payLevel in PAY_LEVEL && p.payLevelSample >= 5) {
    faq.push({ q: `How well does ${e.name} pay?`, a: `Across ${n0(p.payLevelSample)} postings with a posted salary range, ${e.name}'s pay is ${PAY_LEVEL[p.payLevel]}. We compare each posted range with the market range for the same title, function and area.` })
  }

  faq.push(...text.faq)

  const ld: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${SITE_URL}${path}#org`,
      name: e.name,
      ...(e.website ? { url: e.website, sameAs: [e.website] } : {}),
      ...(e.hqMetro ? { address: { '@type': 'PostalAddress', addressLocality: e.hqMetro } } : {}),
      ...(e.industry ? { knowsAbout: e.industry } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${SITE_URL}${path}`,
      url: `${SITE_URL}${path}`,
      name: title(e),
      description: description(e),
      dateModified: new Date().toISOString().slice(0, 10),
      about: { '@id': `${SITE_URL}${path}#org` },
      isPartOf: { '@type': 'WebSite', name: 'NextChapter', url: SITE_URL },
    },
    ...(e.jobs.length ? [{ '@context': 'https://schema.org', '@type': 'ItemList', name: `Open roles at ${e.name}`, itemListElement: e.jobs.map((j, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/jobs/${j.id}`, name: j.title })) }] : []),
    ...(faq.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }] : []),
  ]

  return (
    <OrgBrandScope brand={brand?.pair}>
    <SeoPage
      trail={[{ name: 'Employers', path: '/employers' }, { name: e.name, path }]}
      h1={employerSeo(e.name, null).h1}
      jsonLd={ld}
      lede={<>{hq && <span className="block text-sm">{hq}</span>}{(industryBucket || topFunction) && <span className="block text-sm">Explore: {industryBucket && <a href={industryPath(industryBucket)} className="underline underline-offset-2">{industryBucket}</a>}{industryBucket && topFunction && ' · '}{topFunction && <a href={functionPath(topFunction.name)} className="underline underline-offset-2">{topFunction.name} jobs</a>}</span>}{description(e)}<ClaimHint who={`Work at ${e.name}?`} href={e.claimSlug ? `/prepared/${e.claimSlug}` : '/for-organizations'} event="seo_claim_clicked" properties={{ page: 'employer', audience: 'employer', companyId: e.id, slug: e.slug, openRoles: p?.openNow ?? 0 }} /></>}
    >
      <OrgCandidateBand
        orgName={e.name}
        branded={!!brand}
        peopleCount={null}
        heading={`Interested in ${e.name}? See where you stand.`}
        independent={`Independent page. Not from or affiliated with ${e.name}.`}
        properties={{ kind: 'EMPLOYER', slug: e.slug }}
      />
      <div className="mt-10">
        <SituationFlow variant="neither" company={e.name} slug={e.slug} state={null} action={submitJourneyLead} searchSchools={searchSchools} source={`employer:${e.slug}`} />
      </div>
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
              <span className="font-medium text-foreground">Where:</span> {p.topLocations.slice(0, 8).map((l) => `${l.location} (${n0(l.count)})`).join(', ')}.
            </p>
          )}
        </section>
      )}

      {ins && <EmployerInsights name={e.name} industry={e.industry} ins={ins} text={text} />}

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

      <section aria-label={`Get new ${e.name} openings by email`} className="mt-12">
        <EmployerFollowBox name={e.name} slug={e.slug}>
          <SaveSearchForm q={e.name} loc="" remote={false} source="page:employer" heading={`Get new ${e.name} openings by email`} blurb={`We’ll email you when ${e.name} posts a role. No account needed.`} cta="Email me new openings" />
        </EmployerFollowBox>
      </section>

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

      <CompanyEvents
        id="company-news"
        title={`${e.name} news from SEC filings`}
        intro={`Acquisitions, leadership changes and capital raised by ${e.name}, from its SEC filings in the last 12 months.`}
        events={secEvents}
      />

      {seenConfs.length > 0 && (
        <section aria-labelledby="conferences" className="mt-10">
          <h2 id="conferences" className={H2}>Conferences where {e.name} appears</h2>
          <p className="mt-2 text-sm text-muted-foreground">Listed as an exhibitor, sponsor or speaker on the event’s own pages.</p>
          <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm">
            {seenConfs.map((c) => <li key={c.id}><Link href={`/conferences/${c.id}`} className="underline underline-offset-4">{c.name}</Link></li>)}
          </ul>
        </section>
      )}
      <LocalEventSection id="local-events" title={`Job fairs and events with ${e.name}`} intro="Local hiring events and business events this employer sponsors or recruits at." scope={{ link: { kind: 'COMPANY', id: e.id } }} />
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
      {layoffs && layoffs.slug && (
        <AreaNotices
          id="notices"
          title={`Layoff notices from ${e.name}`}
          intro={`WARN notices ${e.name} has filed with state labor departments.`}
          notices={layoffs}
          moreHref={`/layoffs/company/${layoffs.slug}`}
          moreLabel={`${e.name} layoff history`}
          showState
        />
      )}

      <LinkToUs path={path} name={e.name} kind="employer" />
    </SeoPage>
    </OrgBrandScope>
  )
}
