import type { Metadata } from 'next'
import { LinkToUs } from '@/components/seo/LinkToUs'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SeoPage, H2, LINK, Stat, ActionBand } from '@/components/seo/SeoPage'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { stateName } from '@/lib/seo/states'
import { getSearchFirmBySlug, type SearchFirmPage } from '@/lib/seo/search-firm-pages'
import { FIRM_KIND_LABEL, levelLabel, specialties } from '@/lib/seo/search-firm-bar'
import { titleMeta } from '@/lib/seo/title'

// One page per search firm, recruiting firm, staffing company or outplacement firm with searches of its own to show:
// the roles it is recruiting for now (only ones with a public job page), what it specializes in, where, and how long its
// searches stay open. Built on first visit, refreshed daily. A page below the bar (search-firm-bar.ts) renders but is
// kept out of search results and the sitemap. No layoff data on this page, and no client names.
export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

const n0 = (n: number) => n.toLocaleString('en-US')
const k = (n: number) => `$${Math.round(n / 1000)}k`
const stateLabel = (code: string) => stateName(code) ?? code

function description(f: SearchFirmPage): string {
  const s = f.summary
  if (s.publicRoles === 0) return `${f.name} is a ${FIRM_KIND_LABEL[f.kind].toLowerCase()}${f.hq ? ` based in ${f.hq}` : ''}. No open searches with a public listing right now.`
  const sp = specialties(s).slice(0, 3)
  const bits = [`${f.name} is recruiting for ${n0(s.publicRoles)} ${s.publicRoles === 1 ? 'role' : 'roles'} right now${sp.length ? `, mostly in ${sp.join(', ').toLowerCase()}` : ''}`]
  if (s.medianDaysOpen != null) bits.push(`its searches have been open a median ${n0(s.medianDaysOpen)} days`)
  return `${bits.join('; ')}. Titles, levels, places and posted pay.`
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const f = await getSearchFirmBySlug(slug)
  if (!f) return {}
  return {
    title: titleMeta(`${f.name}: open searches, specialties and pay`),
    description: description(f),
    ...canonical(`/search-firms/${slug}`),
    ...(f.indexable ? {} : { robots: { index: false, follow: true } }),
  }
}

export default async function SearchFirmPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const f = await getSearchFirmBySlug(slug)
  if (!f) notFound()
  const s = f.summary
  const path = `/search-firms/${slug}`
  const sp = specialties(s)
  const track = { slug, orgId: f.orgId, kind: f.kind, publicRoles: s.publicRoles }

  const faq: { q: string; a: string }[] = []
  if (s.publicRoles > 0) {
    faq.push({
      q: `What roles is ${f.name} recruiting for?`,
      a: `${f.name} has ${n0(s.publicRoles)} ${s.publicRoles === 1 ? 'search' : 'searches'} with a public listing as of the last check${s.functions[0] ? `. The most common function is ${s.functions[0].label.toLowerCase()}` : ''}${s.levels[0] ? ` and the most common level is ${s.levels[0].label.toLowerCase()}` : ''}.`,
    })
    if (s.medianDaysOpen != null) faq.push({ q: `How long do ${f.name} searches stay open?`, a: `Its current searches have been listed a median ${n0(s.medianDaysOpen)} days; the longest has been listed ${n0(s.oldestDaysOpen ?? s.medianDaysOpen)} days.` })
    if (s.withPay > 0) faq.push({ q: `Does ${f.name} post pay?`, a: `${n0(s.withPay)} of its ${n0(s.publicRoles)} listed searches state a yearly salary range.` })
  }

  const ld: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'EmploymentAgency',
      '@id': `${SITE_URL}${path}#org`,
      name: f.name,
      url: `${SITE_URL}${path}`,
      ...(f.website ? { sameAs: [f.website] } : {}),
      ...(f.hq ? { address: { '@type': 'PostalAddress', addressLocality: f.hq } } : {}),
      description: description(f),
    },
    ...(f.roles.length
      ? [{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: `Open searches at ${f.name}`,
          numberOfItems: s.publicRoles,
          itemListElement: f.roles.map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.title, url: `${SITE_URL}/jobs/${r.id}` })),
        }]
      : []),
    ...(faq.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })) }] : []),
  ]

  return (
    <SeoPage
      trail={[{ name: 'Search firms', path: '/search-firms' }, { name: f.name, path }]}
      h1={`${f.name}: open searches and specialties`}
      jsonLd={ld}
      lede={<><span className="block text-sm">{[FIRM_KIND_LABEL[f.kind], f.hq].filter(Boolean).join(' · ')}</span>{description(f)}</>}
    >
      {s.publicRoles > 0 && (
        <section aria-labelledby="searches" className="mt-10">
          <h2 id="searches" className={H2}>What it is recruiting for</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat value={n0(s.publicRoles)} label="searches with a public listing" />
            {s.medianDaysOpen != null && <Stat value={n0(s.medianDaysOpen)} label="median days a search has been open" note={s.oldestDaysOpen != null ? `longest ${n0(s.oldestDaysOpen)} days` : undefined} />}
            <Stat value={n0(s.entryLevel)} label="entry-level or no-experience roles" />
            <Stat value={n0(s.aiSkill)} label="roles that name AI skills" />
          </ul>
          {sp.length > 0 && <p className="mt-4 max-w-3xl text-sm text-muted-foreground"><span className="font-medium text-foreground">Specialties, from its live searches:</span> {sp.join(', ')}.</p>}
          {s.levels.length > 0 && <p className="mt-2 max-w-3xl text-sm text-muted-foreground"><span className="font-medium text-foreground">By level:</span> {s.levels.map((l) => `${l.label.toLowerCase()} (${n0(l.count)})`).join(', ')}.</p>}
          {s.states.length > 0 && <p className="mt-2 max-w-3xl text-sm text-muted-foreground"><span className="font-medium text-foreground">Where:</span> {s.states.map((x) => `${stateLabel(x.state)} (${n0(x.count)})`).join(', ')}{s.remote > 0 && <>; {n0(s.remote)} remote</>}.</p>}
          {s.medianPay && <p className="mt-2 max-w-3xl text-sm text-muted-foreground"><span className="font-medium text-foreground">Posted pay:</span> the median posted range is {k(s.medianPay[0])}–{k(s.medianPay[1])} across {n0(s.withPay)} searches that state one.</p>}
        </section>
      )}

      {f.roles.length > 0 && (
        <section aria-labelledby="roles" className="mt-12">
          <h2 id="roles" className={H2}>Open searches</h2>
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-white text-sm">
            {f.roles.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 p-4">
                <Link href={`/jobs/${r.id}`} className={`${LINK} font-medium`}>{r.title}</Link>
                <span className="text-xs text-muted-foreground">{[levelLabel(r.level), r.location, r.pay ? `${k(r.pay[0])}–${k(r.pay[1])}` : null].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
          {s.publicRoles > f.roles.length && <p className="mt-3 text-sm text-muted-foreground">Showing {f.roles.length} of {n0(s.publicRoles)}. <Link href={`/jobs?q=${encodeURIComponent(f.name)}`} className={LINK}>Search all {f.name} roles</Link></p>}
          <p className="mt-2 text-xs text-muted-foreground">Only searches that are listed publicly. Searches a firm runs in confidence are not shown.</p>
        </section>
      )}

      {s.publicRoles === 0 && (
        <p className="mt-10 max-w-3xl text-sm text-muted-foreground">No searches with a public listing right now. This page updates when the firm lists roles.</p>
      )}

      {faq.length > 0 && (
        <section aria-labelledby="faq" className="mt-12">
          <h2 id="faq" className={H2}>Common questions</h2>
          <dl className="mt-4 max-w-3xl space-y-4 text-sm">
            {faq.map((x) => (<div key={x.q}><dt className="font-medium text-navy">{x.q}</dt><dd className="mt-1 text-muted-foreground">{x.a}</dd></div>))}
          </dl>
        </section>
      )}

      {(f.website || f.teamPageUrl) && (
        <p className="mt-10 max-w-3xl text-sm text-muted-foreground">
          {f.website && /^https?:\/\//.test(f.website) && <TrackedLink href={f.website} event="search_firm_outbound_clicked" properties={{ ...track, target: 'website' }} className={LINK} rel="nofollow">{f.name} website</TrackedLink>}
          {f.website && f.teamPageUrl && ' · '}
          {f.teamPageUrl && /^https?:\/\//.test(f.teamPageUrl) && <TrackedLink href={f.teamPageUrl} event="search_firm_outbound_clicked" properties={{ ...track, target: 'team_page' }} className={LINK} rel="nofollow">Team page</TrackedLink>}
        </p>
      )}

      <ActionBand
        title={`Run recruiting at ${f.name}?`}
        body={`Claim this page and set up a free workspace for ${f.name}. Use a work email at your firm’s domain.`}
        label="Claim this page"
        href={`/prepared/${slug}`}
        event="search_firm_claim_clicked"
        properties={{ page: 'search_firm', audience: 'recruiter', ...track }}
      />

      <p className="mt-8 max-w-3xl text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Sources:</span> searches from the firm’s own job board and applicant system, checked
        {s.publicRoles > 0 && f.lastChecked ? ` (last ${f.lastChecked.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})` : ' regularly'}; only roles with a public listing are counted.
      </p>
      <LinkToUs path={path} name={f.name} kind="search_firm" />
    </SeoPage>
  )
}
