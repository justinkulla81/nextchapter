import { meetsCompanyLayoffBar } from '@/lib/seo/page-bars'
import { layoffsCompanySeo } from '@/lib/seo/templates'
import type { Metadata } from 'next'
import Link from 'next/link'
import { FeedLine } from '@/components/seo/FeedLine'
import { notFound, permanentRedirect } from 'next/navigation'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { LayoffAlertForm } from '@/components/layoffs/LayoffAlertForm'
import { CompanyLayoffGuide } from '@/components/layoffs/CompanyLayoffGuide'
import { buildLayoffGuide } from '@/lib/warn/layoff-guide'
import { filingFacts, guidePrograms } from '@/lib/warn/layoff-guide-programs'
import { StructuredData } from '@/components/StructuredData'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { BoardList, NoticeTable } from '@/components/layoffs/NoticeTable'
import { canonical } from '@/lib/seo/canonical'
import { isNetworkCompany, primaryState } from '@/lib/network/eligibility'
import { articleJsonLd, breadcrumbJsonLd } from '@/lib/seo/jsonld'
import { stateName, stateSlug } from '@/lib/seo/states'
import { getRecentNotices } from '@/lib/seo/topic-data'
import { industryPath } from '@/lib/seo/topics'
import { getCompanies, getNewsMentions, type CompanySummary, mergedSlug, noticeDay, resolveCompanySlug, stripSlugSuffixes } from '@/lib/warn/layoff-pages'
import { titleMeta } from '@/lib/seo/title'
import { stateHelpLinks, type CrossLink } from '@/lib/seo/layoff-links'
import { StatementForm } from '@/components/employers/StatementForm'
import { approvedStatementMap } from '@/lib/employer-statements/store'
import { getAnnouncements, hasRecentAnnouncement, type CompanyAnnouncements } from '@/lib/warn/company-announcements'
import { getEmployerBrand } from '@/lib/branding/store'
import { OrgBrandScope } from '@/components/branding/OrgBrandScope'
import { OrgCandidateBand } from '@/components/seo/OrgCandidateBand'
import { ClaimHint } from '@/components/seo/ClaimHint'
import { LandingHero } from '@/components/layoffs/landing/LandingHero'
import { SituationFlow } from '@/components/layoffs/landing/SituationFlow'
import { SearchTimeFacts } from '@/components/layoffs/landing/SearchTimeFacts'
import { PeerEmployers } from '@/components/layoffs/landing/PeerEmployers'
import { landingVariant, SEARCH_TIME_FACTS } from '@/lib/layoffs/landing'
import { searchSchools } from '@/lib/layoffs/landing-actions'
import { getPeerEmployers } from '@/lib/layoffs/peers'
import { BUYOUT_UNEMPLOYMENT_CHECKED, buyoutRuleFor } from '@/lib/warn/buyout-unemployment'
import { submitJourneyLead } from '@/lib/leads/actions'

// Pages are built on first visit and refreshed daily; there are over a
// thousand employers, too many to prerender on every deploy.
export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

async function load(slug: string) {
  const companies = await getCompanies()
  const c = companies.get(slug)
  if (c && mergedSlug(slug) === slug) return c
  if (mergedSlug(slug) !== slug && companies.has(mergedSlug(slug))) permanentRedirect(`/layoffs/company/${mergedSlug(slug)}`)
  // A spelling from before one employer's filings were merged ("intel-corporation" → "intel").
  const merged = stripSlugSuffixes(slug)
  if (merged !== slug && companies.has(merged)) permanentRedirect(`/layoffs/company/${merged}`)
  // A fuller or shorter spelling of an employer we do have ("woodbridge-group-lansing").
  const alias = resolveCompanySlug(slug, companies.keys())
  if (alias && alias !== slug) permanentRedirect(`/layoffs/company/${alias}`)
  return null
}

/** The employer's WARN record and its announcements; an employer with only announcements gets a page with no notices. */
async function loadPage(slug: string): Promise<{ c: CompanySummary; ann: CompanyAnnouncements | undefined } | null> {
  const announcements = await getAnnouncements().catch(() => new Map<string, CompanyAnnouncements>())
  const ann = announcements.get(slug)
  const c = await load(slug)
  if (c) return { c, ann }
  if (ann) return { c: { slug, name: ann.name, notices: [], latest: ann.latest, states: [] }, ann }
  return null
}

/** The county or city named most often in a state's notices, to find programs for where the layoff is. */
function guidePlaces(c: CompanySummary): Record<string, string | null> {
  const out: Record<string, string | null> = {}
  for (const state of c.states) {
    const counts = new Map<string, number>()
    for (const n of c.notices) if (n.state === state && n.place) counts.set(n.place, (counts.get(n.place) ?? 0) + 1)
    out[state] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  }
  return out
}

const KIND_LABEL = { buyout: 'Voluntary buyout offer', layoff: 'Reported layoff' } as const

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const page = await loadPage(slug)
  if (!page) return {}
  const { c, ann } = page
  const recent = hasRecentAnnouncement(ann)
  const workers = c.notices.reduce((s, n) => s + (n.workers ?? 0), 0)
  const lead = recent && ann ? ann.items[0] : null
  const description = lead && !c.notices.length
    ? `${c.name}: ${lead.summary} (${noticeDay(lead.date)}). What was announced, the source, and what to do if you are affected: benefits, severance, COBRA and local help.`
    : `${lead ? `${lead.summary} (${noticeDay(lead.date)}). ` : ''}${c.notices.length} WARN layoff ${c.notices.length === 1 ? 'notice' : 'notices'} filed by ${c.name} in ${c.states.map(stateName).join(', ')}${workers ? `, naming ${workers.toLocaleString()} workers` : ''}. Latest filed ${noticeDay(c.latest)}. Dates, locations and the state record for each.`
  // A page whose newest notice is over two years old, or that is too small to be worth a search result
  // (src/lib/seo/page-bars.ts), stays reachable but out of search results.
  const stale = !meetsCompanyLayoffBar(c) && !recent
  return {
    title: titleMeta(recent ? `${c.name} Layoffs and Buyouts: What Was Announced` : layoffsCompanySeo(c.name).title),
    description,
    ...canonical(`/layoffs/company/${slug}`),
    ...(stale ? { robots: { index: false, follow: true } } : {}),
  }
}

const LINK = 'text-brand underline underline-offset-4'
const H2 = 'text-2xl font-bold tracking-tight text-navy'

export default async function CompanyLayoffsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = await loadPage(slug)
  if (!page) notFound()
  const { c, ann } = page
  const recentAnn = hasRecentAnnouncement(ann) ? ann : undefined
  const hasNotices = c.notices.length > 0
  const bucket = (await getRecentNotices().catch(() => [])).find((n) => n.slug === slug && n.bucket)?.bucket ?? null
  const [mentions, statements] = await Promise.all([getNewsMentions(c), approvedStatementMap(slug, c.name)])
  const stateHelp = await Promise.all(c.states.slice(0, 3).map((code) => stateHelpLinks(code)))
  const helpLinks: CrossLink[] = [...new Map(stateHelp.flat().map((l) => [l.href, l])).values()]
  const workers = c.notices.reduce((s, n) => s + (n.workers ?? 0), 0)
  const unknownCounts = c.notices.some((n) => n.workers == null)
  // The employer's own colors, read from its website (src/lib/branding), when we have them.
  const brand = await getEmployerBrand(c.name)
  // Dated markup for search and AI answer engines: when the page's facts last changed, and the plain answers to what people ask.
  const modified = (ann && ann.latest > c.latest ? ann.latest : c.latest).toISOString().slice(0, 10)
  const path = `/layoffs/company/${slug}`
  const headline = recentAnn ? `${c.name} layoffs and buyouts: what was announced` : layoffsCompanySeo(c.name).h1
  const latestAnn = recentAnn?.items[0]
  const variant = landingVariant({
    hasRecentBuyout: !!recentAnn?.items.some((a) => a.kind === 'buyout'),
    hasNoticesOrLayoffReport: hasNotices || !!recentAnn,
  })
  const rule = buyoutRuleFor(c.states[0])
  const buyoutRule = rule && c.states[0] ? { ...rule, stateName: stateName(c.states[0]), checked: BUYOUT_UNEMPLOYMENT_CHECKED } : null
  const peers = await getPeerEmployers(c.name, hasNotices ? primaryState(c.notices) : null)
  const searchFact = `People still out of work in ${SEARCH_TIME_FACTS.asOf.split(' ')[0]} had been looking for ${Math.round(SEARCH_TIME_FACTS.averageWeeksAll)} weeks on average, so a week spent now is a week saved later.`
  const noticeSentence = (
    <>
      {c.name} has filed {c.notices.length.toLocaleString()} WARN {c.notices.length === 1 ? 'notice' : 'notices'} with{' '}
      {c.states.length === 1 ? `the ${stateName(c.states[0])} labor department` : `labor departments in ${c.states.length} states`}
      {workers > 0 && <>, naming {workers.toLocaleString()} workers{unknownCounts ? ' where a count was given' : ''}</>}. The most recent was filed {noticeDay(c.latest)}.
    </>
  )
  const heroContext =
    variant === 'buyout' && latestAnn ? <>Reported {noticeDay(latestAnn.date)}: {latestAnn.summary}. {searchFact}</>
    : hasNotices ? <>{noticeSentence} {searchFact}</>
    : latestAnn ? <>Reported {noticeDay(latestAnn.date)}: {latestAnn.summary}. {c.name} has not filed a WARN notice that we have on record. {searchFact}</>
    : <>{searchFact}</>
  const faq = hasNotices
    ? [
        { q: `Is ${c.name} laying off employees?`, a: `${c.name} has filed ${c.notices.length.toLocaleString()} WARN layoff ${c.notices.length === 1 ? 'notice' : 'notices'}. The latest was filed ${noticeDay(c.latest)}.` },
        { q: `How many ${c.name} workers are affected?`, a: workers > 0 ? `The notices on record name ${workers.toLocaleString()} workers${unknownCounts ? ', counting only the notices that gave a number' : ''}.` : 'The notices on record do not state a worker count.' },
        { q: `Where are the ${c.name} layoffs?`, a: `${c.name} filed in ${c.states.map(stateName).join(', ')}.` },
      ]
    : []

  return (
    <OrgBrandScope brand={brand?.pair}>
    <div className="flex flex-1 flex-col">
      <StructuredData data={breadcrumbJsonLd([{ name: 'Layoff tracker', path: '/layoffs' }, { name: c.name, path: `/layoffs/company/${slug}` }])} />
      <StructuredData data={articleJsonLd({ headline, path, dateModified: modified, type: 'Article' })} />
      {faq.length > 0 && (
        <StructuredData data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }} />
      )}
      <PublicSiteHeader current="news" />
      <main className="flex-1 bg-off-white py-12">
        <div className="mx-auto max-w-6xl px-6">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <Link href="/layoffs" className="hover:text-foreground">Layoff tracker</Link>
            <span aria-hidden> › </span>
            <span className="text-foreground">{c.name}</span>
            <span className="ml-3">Updated {noticeDay(new Date(`${modified}T12:00:00Z`))}</span>
          </nav>
          <ClaimHint
            who={`HR or workforce staff helping the people affected by the ${c.name} layoff?`}
            label="See how outplacement works for these workers"
            href="/outplacement"
            event="seo_org_ask_clicked"
            properties={{ page: 'layoff', audience: 'employer_hr', slug, hasNotices }}
          />

          <div className="mt-4 space-y-12">
            <LandingHero variant={variant} name={c.name} slug={slug} latestWorkers={hasNotices ? (c.notices[0]?.workers ?? null) : null} hasNotices={hasNotices} context={heroContext} />
            <SituationFlow variant={variant} company={c.name} slug={slug} state={c.states[0] ?? null} action={submitJourneyLead} searchSchools={searchSchools} buyoutRule={buyoutRule} />
            <SearchTimeFacts />
            <PeerEmployers company={c.name} near={peers.near} similar={peers.similar} metro={peers.homeState ? stateName(peers.homeState) : null} />
          </div>

          <OrgCandidateBand
            orgName={c.name}
            branded={!!brand}
            peopleCount={null}
            heading={`Affected by changes at ${c.name}? See where you stand.`}
            independent={`Independent page. Not from or affiliated with ${c.name}.`}
            properties={{ kind: 'LAYOFF_COMPANY', slug }}
          />

          {ann && (
            <section aria-labelledby="announced" className="mt-10">
              <h2 id="announced" className={H2}>Announced and reported</h2>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Company announcements and press reports, kept apart from WARN filings. A buyout is an offer, not a layoff: it counts no one as laid off,
                and how many accept is not known until the company says. These do not change the notice and worker counts below.
              </p>
              <ul className="mt-4 space-y-3">
                {ann.items.map((a) => (
                  <li key={a.id} className="rounded-xl border border-border bg-white p-4 text-sm">
                    <p className="font-semibold text-navy">{KIND_LABEL[a.kind]} · {noticeDay(a.date)}</p>
                    <p className="mt-1">{a.summary}</p>
                    {a.sourceUrl && (
                      <TrackedLink href={a.sourceUrl} event="layoff_announcement_source_clicked" properties={{ company: slug, kind: a.kind }} className="mt-1 inline-block text-brand underline underline-offset-4">
                        Source
                      </TrackedLink>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <CompanyLayoffGuide
            name={c.name}
            slug={slug}
            states={c.states}
            filing={filingFacts(c.states)}
            programs={guidePrograms({ states: c.states, places: guidePlaces(c), industryBucket: bucket })}
            guide={buildLayoffGuide({
              name: c.name,
              notices: c.notices,
              announcements: ann?.items.map((a) => ({ kind: a.kind, date: a.date })) ?? [],
            })}
          />

          <section aria-labelledby="affected" className="mt-12 rounded-xl border border-border bg-white p-6">
            <h2 id="affected" className="text-xl font-semibold tracking-tight text-navy">What to do if you’re affected</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A free account turns this page into a plan: your benefits and deadlines, severance and COBRA numbers, and jobs matched to your background.
            </p>
            <TrackedLink href="/onboarding/desire" event="layoff_company_account_cta_clicked" properties={{ company: slug, hasNotices, announced: !!ann }} className="mt-3 inline-block rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white hover:opacity-90">
              Create a free account
            </TrackedLink>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
              {hasNotices && isNetworkCompany(c) && (
                <li><Link href={`/network/company/${slug}`} className={LINK}>Jobs, benefits and retraining for {c.name} employees and alumni</Link></li>
              )}
              {bucket && (
                <li><Link href={industryPath(bucket)} className={LINK}>{bucket}: open jobs, conferences and other recent layoffs</Link></li>
              )}
              <li><Link href="/start/laid-off" className={LINK}>Start here: a plan for the weeks after a layoff</Link></li>
              {helpLinks.map((l) => <li key={l.href}><Link href={l.href} className={LINK}>{l.label}</Link></li>)}
              {c.states.map((s) => (
                <li key={s}>
                  <Link href={`/unemployment-benefits/${stateSlug(s)}`} className={LINK}>{stateName(s)} unemployment benefits and how to file</Link>
                </li>
              ))}
              {c.states.slice(0, 1).map((s) => <li key={`feed-${s}`}><FeedLine feed={`/feeds/layoffs/${stateSlug(s)}`} label={`Get new ${stateName(s)} notices by RSS`} /></li>)}
              <li><Link href="/resources/72-hours" className={LINK}>The first 72 hours after a layoff</Link></li>
              <li><Link href="/resources/cobra-aca" className={LINK}>COBRA and marketplace health coverage</Link></li>
              <li><Link href="/resources/bridge-income" className={LINK}>Bridge income while you search</Link></li>
            </ul>
          </section>

          {hasNotices && <section aria-labelledby="notices" className="mt-10">
            <h2 id="notices" className={H2}>Notices</h2>
            <div className="mt-4">
              <NoticeTable notices={c.notices} caption={`WARN notices filed by ${c.name}, newest first`} showState={c.states.length > 1} page="company" statements={statements} />
            </div>
            <StatementForm
              slug={slug}
              companyName={c.name}
              notices={c.notices.slice(0, 15).map((n) => ({ id: n.id, label: `${noticeDay(n.noticeDate)}, ${stateName(n.state)}${n.workers != null ? `, ${n.workers.toLocaleString()} workers` : ''}` }))}
            />
          </section>}

          {mentions.length > 0 && (
            <section aria-labelledby="news" className="mt-12">
              <h2 id="news" className={H2}>In the news</h2>
              <ul className="mt-4 space-y-3">
                {mentions.map((m) => (
                  <li key={m.id} className="text-sm">
                    <TrackedLink href={m.url} event="layoff_news_clicked" properties={{ mentionId: m.id, company: slug }} className="font-medium text-navy hover:text-brand hover:underline">
                      {m.headline}
                    </TrackedLink>
                    <span className="text-muted-foreground">
                      {m.publisher && ` · ${m.publisher}`}
                      {m.publishedAt && ` · ${noticeDay(m.publishedAt)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {hasNotices && <section aria-labelledby="boards" className="mt-12">
            <h2 id="boards" className={H2}>Local workforce boards</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              The public workforce boards for each location in these notices. Their American Job Centers offer free help with
              job search, training and filing for benefits, and some run rapid-response services for workers in a WARN layoff.
            </p>
            <div className="mt-4"><BoardList notices={c.notices} page="company" /></div>
          </section>}

          {hasNotices && <p className="mt-10 max-w-3xl text-sm text-muted-foreground">
            These are the notices {c.name} filed under the WARN Act, as published by each state. A notice gives the number of
            workers and dates the employer reported; it does not say why. See the{' '}
            <Link href="/layoffs" className={LINK}>layoff tracker</Link> for how notices are collected and what they cover.
          </p>}
          <div className="mt-10">
            <LayoffAlertForm employer={slug} employerName={c.name} source="layoffs:company" />
          </div>
          <p className="mt-12 text-center text-sm text-muted-foreground">
            Want to browse openings on your own? <Link href="/jobs" className={LINK}>Go to the job board →</Link>
          </p>
        </div>
      </main>
      <PublicSiteFooter page="layoffs" />
    </div>
    </OrgBrandScope>
  )
}
