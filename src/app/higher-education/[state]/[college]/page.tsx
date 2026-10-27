import type { Metadata } from 'next'
import { LinkToUs } from '@/components/seo/LinkToUs'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { SeoPage, H2, LINK, Stat, ActionBand } from '@/components/seo/SeoPage'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { ClaimHint } from '@/components/seo/ClaimHint'
import { ConferenceSection } from '@/components/events/ConferenceSection'
import { LocalEventSection } from '@/components/events/LocalEventSection'
import { conferencesHostedBy, hasHostedConferences } from '@/lib/events/conference-places'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { stateFromSlug } from '@/lib/seo/states'
import { AI_LEVELS, AI_TRACK_LABEL, aiProgramSentence, collegePath, territoryFromSlug } from '@/lib/seo/college-bar'
import { areaName, getCollegePage, type CollegePageData } from '@/lib/seo/college-pages'
import { functionByName, functionPath } from '@/lib/seo/topics'

// One page per college: IPEDS and College Scorecard facts, the job market in its county, the workforce board and
// American Job Centers that serve it, and peer colleges. Built on first visit, refreshed daily. A college below the
// bar (college-bar.ts) renders but is kept out of search results and the sitemap. No layoff data on any page.
export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

const n0 = (n: number) => n.toLocaleString('en-US')
const usd = (n: number) => `$${n0(Math.round(n))}`
const pct = (x: number) => `${Math.round(x * 100)}%`
const trend = (now: number, prior: number | null) => {
  if (prior == null) return ''
  const d = Math.round((now - prior) * 10) / 10
  return d === 0 ? 'unchanged from a year earlier' : `${d > 0 ? 'up' : 'down'} ${Math.abs(d).toFixed(1)} points from a year earlier`
}
const kind = (c: CollegePageData) => [c.control, c.level].filter(Boolean).join(' ').toLowerCase()

function description(c: CollegePageData, st: string): string {
  const bits: string[] = [`${c.name} is a ${kind(c) || 'college'} in ${c.city ? `${c.city}, ` : ''}${st}`]
  if (c.enrollment) bits[0] += ` with about ${n0(c.enrollment)} students`
  if (c.topMajors[0]) bits.push(`most degrees are in ${c.topMajors.slice(0, 2).map((m) => m.field.toLowerCase()).join(' and ')}`)
  const ai = aiProgramSentence(c.aiPrograms)
  if (ai) bits.push(`awards degrees or certificates in ${ai}`)
  if (c.market && c.market.jobsOpen > 0) bits.push(`${n0(c.market.jobsOpen)} open professional jobs in ${c.market.county.name}`)
  return `${bits.join('; ')}. Graduation, earnings and net price, local employers hiring, and the nearest workforce board.`
}

async function load(state: string, college: string) {
  const code = stateFromSlug(state) ?? territoryFromSlug(state)
  if (!code) return null
  const c = await getCollegePage(code, college)
  return c ? { code, c } : null
}

export async function generateMetadata({ params }: { params: Promise<{ state: string; college: string }> }): Promise<Metadata> {
  const { state, college } = await params
  const d = await load(state, college)
  if (!d) return {}
  const { c } = d
  return {
    title: `${c.name}: programs, outcomes and local jobs`,
    description: description(c, areaName(d.code)),
    ...canonical(collegePath(state, c.canonicalSlug)),
    ...(c.indexable ? {} : { robots: { index: false, follow: true } }),
  }
}

export default async function CollegePublicPage({ params }: { params: Promise<{ state: string; college: string }> }) {
  const { state, college } = await params
  const d = await load(state, college)
  if (!d) notFound()
  const { code, c } = d
  if (c.canonicalSlug !== college) permanentRedirect(collegePath(state, c.canonicalSlug))
  const st = areaName(code)
  const path = collegePath(state, c.canonicalSlug)
  const m = c.market
  const topFn = m?.topFunctions[0] ? functionByName(m.topFunctions[0].function) : null
  const where = c.city ? `${c.city}, ${st}` : st

  const faq: { q: string; a: string }[] = []
  if (c.enrollment) faq.push({ q: `How big is ${c.name}?`, a: `${c.name} enrolls about ${n0(c.enrollment)} students and is a ${kind(c)} institution in ${where}${c.annualAwards ? `. It awards about ${n0(c.annualAwards)} degrees and certificates a year` : ''}.` })
  if (c.completionRate != null) faq.push({ q: `What is the graduation rate at ${c.name}?`, a: `${pct(c.completionRate)} of students complete, from the U.S. Department of Education College Scorecard (${c.dataYear ?? 'latest release'}).` })
  if (c.earnings10 != null || c.earnings6 != null) {
    faq.push({ q: `What do ${c.name} graduates earn?`, a: `Median earnings of students who received federal aid are ${[c.earnings6 != null ? `${usd(c.earnings6)} six years after entry` : '', c.earnings10 != null ? `${usd(c.earnings10)} ten years after entry` : ''].filter(Boolean).join(' and ')}, from the College Scorecard.` })
  }
  if (c.aiPrograms) {
    const sentence = aiProgramSentence(c.aiPrograms)
    faq.push({
      q: `Does ${c.name} offer AI or data science degrees?`,
      a: sentence
        ? `Yes. ${c.name} awarded degrees or certificates in ${sentence} in ${c.aiPrograms.year}, from IPEDS completions by program.`
        : `${c.name} reported no degrees or certificates in artificial intelligence, data science, data analytics or robotics for ${c.aiPrograms.year} (IPEDS completions). A new program with no graduates yet would not appear.`,
    })
  }
  if (m && m.jobsOpen > 0) faq.push({ q: `Are there jobs near ${c.name}?`, a: `${n0(m.jobsOpen)} open professional jobs are listed in ${m.county.name}, ${n0(m.entryLevel)} of them entry level and ${n0(m.noExperience)} saying no experience is needed. ${m.topEmployers[0] ? `${m.topEmployers[0].name} has the most openings.` : ''}`.trim() })

  const ld: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollegeOrUniversity',
      '@id': `${SITE_URL}${path}#college`,
      name: c.name,
      url: `${SITE_URL}${path}`,
      ...(c.website ? { sameAs: c.website.startsWith('http') ? c.website : `https://${c.website}` } : {}),
      address: { '@type': 'PostalAddress', ...(c.city ? { addressLocality: c.city } : {}), addressRegion: code, ...(c.zip ? { postalCode: c.zip } : {}), addressCountry: 'US' },
      ...(c.topMajors.length ? { knowsAbout: c.topMajors.map((x) => x.field) } : {}),
    },
    ...(c.peers.length
      ? [{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: `Colleges similar to ${c.name}`,
          itemListElement: c.peers.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.name, url: `${SITE_URL}${collegePath(state, p.slug)}` })),
        }]
      : []),
    ...(faq.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }] : []),
  ]
  const events = { page: 'college', audience: 'higher_ed', unitid: c.unitid, state: code, slug: c.canonicalSlug, indexable: c.indexable }

  return (
    <SeoPage
      trail={[{ name: 'Higher education', path: '/higher-education' }, { name: st, path: `/higher-education/${state}` }, { name: c.name, path }]}
      h1={`${c.name}: programs, outcomes and local jobs`}
      jsonLd={ld}
      lede={<><span className="block text-sm">{[where, kind(c)].filter(Boolean).join(' · ')}</span>{description(c, st)}<ClaimHint who={`Work in career services or alumni relations at ${c.name}?`} href={c.claimSlug ? `/prepared/${c.claimSlug}` : '/higher-education#claim'} event="seo_claim_clicked" properties={events} /></>}
    >
      <section aria-labelledby="facts" className="mt-10">
        <h2 id="facts" className={H2}>{c.name} at a glance</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {c.enrollment != null && <Stat value={n0(c.enrollment)} label="students enrolled" />}
          {c.alumniReported != null && <Stat value={n0(c.alumniReported)} label="alumni, as the college reports" />}
          {c.annualAwards != null && <Stat value={n0(c.annualAwards)} label="degrees and certificates a year" />}
          {c.completionRate != null && <Stat value={pct(c.completionRate)} label="of students complete" note="College Scorecard" />}
          {c.netPrice != null && <Stat value={usd(c.netPrice)} label="average net price a year" note={c.tuitionInState != null ? `Tuition ${usd(c.tuitionInState)}${c.tuitionOutState != null && c.tuitionOutState !== c.tuitionInState ? ` in state, ${usd(c.tuitionOutState)} out of state` : ''}` : undefined} />}
          {c.earnings6 != null && <Stat value={usd(c.earnings6)} label="median earnings, 6 years after entry" />}
          {c.earnings10 != null && <Stat value={usd(c.earnings10)} label="median earnings, 10 years after entry" note={c.employedShare10 != null ? `${pct(c.employedShare10)} working` : undefined} />}
        </ul>
        {(c.hasExecEd || c.hasRetraining) && (
          <p className="mt-3 text-sm text-muted-foreground">
            {[c.hasExecEd ? 'Executive education programs' : '', c.hasRetraining ? 'Career retraining programs' : ''].filter(Boolean).join(' and ')} listed on its site.
          </p>
        )}
      </section>

      {c.topMajors.length > 0 && (
        <section aria-labelledby="programs" className="mt-12">
          <h2 id="programs" className={H2}>What students study</h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
            <table className="w-full min-w-[26rem] text-left text-sm">
              <caption className="sr-only">Largest fields of study at {c.name}</caption>
              <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
                <tr><th scope="col" className="p-3">Field of study</th><th scope="col" className="p-3">Share of awards</th><th scope="col" className="p-3">Awards a year</th></tr>
              </thead>
              <tbody>
                {c.topMajors.map((x) => (
                  <tr key={x.field} className="border-b border-border last:border-0">
                    <td className="p-3">{x.field}</td><td className="p-3 tabular-nums">{pct(x.share)}</td><td className="p-3 tabular-nums">{n0(x.awards)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {c.aiPrograms && (
        <section aria-labelledby="ai" className="mt-12">
          <h2 id="ai" className={H2}>AI and data programs</h2>
          {c.aiPrograms.programs.length > 0 ? (
            <>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Degrees and certificates awarded in {c.aiPrograms.year}, by program area and level, from IPEDS completions.
              </p>
              <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
                <table className="w-full min-w-[30rem] text-left text-sm">
                  <caption className="sr-only">AI and data degrees and certificates at {c.name}</caption>
                  <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
                    <tr><th scope="col" className="p-3">Program area</th>{AI_LEVELS.map((l) => <th key={l} scope="col" className="p-3 capitalize">{l === 'certificate' ? 'Certificates' : l === 'associate' ? 'Associate' : l === 'bachelor' ? 'Bachelor’s' : l === 'master' ? 'Master’s' : 'Doctorate'}</th>)}</tr>
                  </thead>
                  <tbody>
                    {Object.keys(AI_TRACK_LABEL).filter((t) => c.aiPrograms!.programs.some((p) => p.track === t)).map((t) => (
                      <tr key={t} className="border-b border-border last:border-0">
                        <td className="p-3">{AI_TRACK_LABEL[t]}</td>
                        {AI_LEVELS.map((l) => { const a = c.aiPrograms!.programs.find((p) => p.track === t && p.level === l)?.awards; return <td key={l} className="p-3 tabular-nums">{a ? n0(a) : ''}</td> })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              {c.name} reported no degrees or certificates in artificial intelligence, data science, data analytics or robotics for {c.aiPrograms.year}. A new program with no graduates yet would not appear here.
            </p>
          )}
        </section>
      )}

      {m && (
        <section aria-labelledby="market" className="mt-12">
          <h2 id="market" className={H2}>The job market around {c.name}</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Professional jobs listed in the cities of <Link href={`/places/${state}/county/${m.county.slug}`} className={LINK}>{m.county.name}</Link>, where the college is.
          </p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat value={n0(m.jobsOpen)} label="open professional jobs" />
            <Stat value={n0(m.entryLevel)} label="entry level" note={m.noExperience > 0 ? `${n0(m.noExperience)} say no experience is needed` : undefined} />
            <Stat value={m.jobsOpen > 0 ? pct(m.aiSkill / m.jobsOpen) : '0%'} label="ask for AI skills" note={`${n0(m.aiSkill)} jobs`} />
            {m.county.unemploymentRate != null && <Stat value={`${m.county.unemploymentRate.toFixed(1)}%`} label={`unemployment in ${m.county.name}`} note={[m.county.asOf, trend(m.county.unemploymentRate, m.county.unemploymentRatePrior)].filter(Boolean).join(' · ') || undefined} />}
            {m.county.medianHouseholdIncome != null && <Stat value={usd(m.county.medianHouseholdIncome)} label="median household income" note={m.county.name} />}
            {m.county.whiteCollarShare != null && <Stat value={pct(m.county.whiteCollarShare)} label="of workers are in professional jobs" note={m.county.wcUnemploymentEst != null ? `estimated ${m.county.wcUnemploymentEst.toFixed(1)}% unemployment among them` : undefined} />}
          </ul>
          {m.matchedFunctions.length > 0 && (
            <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Jobs that fit what students study here:</span> most degrees are in {m.matchedFields.map((f) => f.toLowerCase()).join(', ')}, which lead to{' '}
              {m.matchedFunctions.map((f, i) => <span key={f.function}>{i > 0 && ', '}<Link href={functionPath(f.function)} className={LINK}>{f.function.toLowerCase()}</Link> ({n0(f.count)} open)</span>)}.
            </p>
          )}
          {m.topEmployers.length > 0 && (
            <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Hiring most:</span>{' '}
              {m.topEmployers.map((e, i) => (
                <span key={e.name}>{i > 0 && ', '}{e.href ? <Link href={e.href} className={LINK}>{e.name}</Link> : e.name} ({n0(e.openRoles)})</span>
              ))}.
            </p>
          )}
          {m.topFunctions.length > 0 && (
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              <span className="font-medium text-foreground">What they hire for:</span> {m.topFunctions.map((f) => `${f.function} (${n0(f.count)})`).join(', ')}.
              {topFn && <> <Link href={functionPath(topFn.name)} className={LINK}>{topFn.name} jobs</Link></>}
            </p>
          )}
        </section>
      )}

      {(c.boards.length > 0 || c.centers.length > 0) && (
        <section aria-labelledby="help" className="mt-12">
          <h2 id="help" className={H2}>Job search help near campus</h2>
          {c.boards.length > 0 && (
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Workforce {c.boards.length === 1 ? 'board' : 'boards'}:</span>{' '}
              {c.boards.map((b, i) => <span key={b.href}>{i > 0 && ', '}<Link href={b.href} className={LINK}>{b.name}</Link></span>)}.
            </p>
          )}
          {c.centers.length > 0 && (
            <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-white text-sm">
              {c.centers.map((j) => (
                <li key={j.name} className="flex flex-wrap items-baseline justify-between gap-2 p-4">
                  <span className="font-medium text-navy">{j.detailsUrl && /^https?:\/\//.test(j.detailsUrl)
                    ? <TrackedLink href={j.detailsUrl} event="college_outbound_clicked" properties={{ ...events, target: 'job_center' }} className={LINK}>{j.name}</TrackedLink>
                    : j.name}</span>
                  <span className="text-xs text-muted-foreground">{[j.city, j.phone, j.hours].filter(Boolean).join(' · ')}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted-foreground">American Job Centers are free, public career offices.</p>
        </section>
      )}

      <LocalEventSection id="local-events" title={`Job fairs and events with ${c.name}`} intro="Career fairs, employer events and business events this college hosts or joins." scope={{ link: { kind: 'COLLEGE', id: c.unitid } }} />


      {hasHostedConferences(c.unitid) && (
        <ConferenceSection id="conferences" title={`Conferences hosted by ${c.name}`} intro="Events this college organizes, as named on the event’s own site."
          source={`college:${c.unitid}`} load={() => conferencesHostedBy(c.unitid)} />
      )}

      {c.peers.length > 0 && (
        <section aria-labelledby="peers" className="mt-12">
          <h2 id="peers" className={H2}>Similar colleges in {st}</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
            {c.peers.map((p) => (
              <li key={p.unitid} className="rounded-xl border border-border bg-white p-4">
                <Link href={collegePath(state, p.slug)} className={`${LINK} font-medium`}>{p.name}</Link>
                <span className="block text-xs text-muted-foreground">{[p.city, p.enrollment ? `${n0(p.enrollment)} students` : ''].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm"><Link href={`/higher-education/${state}`} className={LINK}>All {st} colleges</Link></p>
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
        title={`Work in career services or alumni relations at ${c.name}?`}
        body={`Claim this page and set up a free workspace for ${c.name}’s alumni and students. Use a work email at the college’s domain.`}
        label="Claim this page"
        href={c.claimSlug ? `/prepared/${c.claimSlug}` : '/higher-education#claim'}
        event="seo_claim_clicked"
        properties={events}
      />
      {c.website && (
        <p className="mt-6 text-sm">
          <TrackedLink href={c.website.startsWith('http') ? c.website : `https://${c.website}`} event="college_outbound_clicked" properties={{ ...events, target: 'college_site' }} className={LINK} rel="nofollow">
            {c.name} website
          </TrackedLink>
        </p>
      )}

      <p className="mt-8 max-w-3xl text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Sources:</span> enrollment and degrees from IPEDS (U.S. Department of Education); graduation, earnings and net price from the College Scorecard{c.dataYear ? ` (${c.dataYear})` : ''};
        open jobs from employers’ career sites, checked daily; unemployment from the Bureau of Labor Statistics; workforce boards and American Job Centers from CareerOneStop.
      </p>
      <LinkToUs path={path} name={c.name} kind="college" />
    </SeoPage>
  )
}
