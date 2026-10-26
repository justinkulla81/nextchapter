import { fitDescription } from '@/lib/seo/templates'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Chips, ConferenceList, FactGrid, H2, JoinBand, LINK, Section, TopicShell, functionChip, industryChip } from '@/components/topics/blocks'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { associationPath, conferencePath, industryByName, industryPath } from '@/lib/seo/topics'
import { conferencesForOrganizer, getConference, getConferenceAssessments, getJobStats, getTopicJobs, type TopicJobs } from '@/lib/seo/topic-data'
import { employerPageSlugs } from '@/lib/events/conference-employers'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { getIndustryTrends } from '@/lib/market/bls-industry-trends'
import { jobFacts, trendFact } from '@/lib/seo/topic-facts'
import { ACCESS_LABEL, FORMAT_LABEL, JOURNEY_LABEL, KIND_LABEL, PROGRAM_LABEL, SENIORITY_LABEL, SPEAKING_LABEL, type Seniority, type Speaking } from '@/lib/events/types'
import { OPPORTUNITY_LABEL } from '@/lib/conferences/constants'
import { effectiveFunctions } from '@/lib/seo/function-inference'
import { costLabel, hasUpcomingDates, whenLabel, whereLabel } from '@/lib/events/format'
import { titleMeta } from '@/lib/seo/title'

export const revalidate = 3600
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

const day = (d: Date | string) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const EMPTY_JOBS: TopicJobs = { total: 0, jobs: [], functions: [], industries: [], employers: [] }
const SPEAKER_GROUP = { KEYNOTE: 'Keynotes', MODERATOR: 'Moderators', PANELIST: 'Panelists', SPEAKER: 'Speakers' } as const
const ROLE_LABEL: Record<string, string> = { EXHIBITOR: 'Exhibiting', SPONSOR: 'Sponsoring', SPEAKER: 'Speaking', ATTENDEE: 'Attending' }

async function load(id: string) {
  const d = await getConference(id)
  if (!d) return null
  const primary = d.conf.industries.map((n) => industryByName(n)).find((i) => i?.rule) ?? null
  const employerSlugs = await employerPageSlugs([...d.employers.map((e) => e.name), ...d.speakers.map((p) => p.organization ?? '').filter(Boolean)])
  const [jobs, stats, trends, organizerConfs] = await Promise.all([
    primary?.rule ? getTopicJobs({ rule: primary.rule }).catch(() => EMPTY_JOBS) : Promise.resolve(EMPTY_JOBS),
    primary?.rule ? getJobStats({ rule: primary.rule }) : Promise.resolve(null),
    getIndustryTrends(),
    d.association ? conferencesForOrganizer(d.association.organizers).then((l) => l.rows.filter((r) => r.id !== d.conf.id).slice(0, 4)).catch(() => []) : Promise.resolve([]),
  ])
  const fieldFacts = [...jobFacts(jobs.total, stats).filter((f) => ['open', 'pay', 'entry'].includes(f.key)), ...[trendFact(primary ? trends[primary.name] : undefined, primary?.name)].filter((x): x is NonNullable<ReturnType<typeof trendFact>> => !!x)]
  return { ...d, jobs, organizerConfs, fieldFacts, employerSlugs, primaryIndustry: primary?.name ?? null }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const d = await getConference(slug)
  if (!d) return { title: 'Conference not found', robots: { index: false, follow: true } }
  const c = d.conf
  const indexable = (await getConferenceAssessments().catch(() => null))?.get(c.id)?.indexable ?? true
  const when = whenLabel(c)
  const where = whereLabel(c)
  const speak = c.speaking === 'OPEN_CFP' ? ' Open call for speakers.' : ''
  return {
    title: titleMeta(`${c.name}: dates, cost, speakers and employers`),
    description: fitDescription(`${c.name}${c.organizer ? ` by ${c.organizer}` : ''}. ${when}${where ? `, ${where}` : ''}. ${costLabel(c)}.${speak} Industries, functions and speaking opportunities.`.replace(/\s+/g, ' '), 165),
    robots: { index: indexable, follow: true },
    ...canonical(conferencePath(c.id)),
  }
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-navy">{children}</dd>
    </div>
  )
}

export default async function ConferencePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const d = await load(slug)
  if (!d) notFound()
  const { conf: c, editions, opportunities, employers, speakers, association, related, jobs, primaryIndustry, organizerConfs, fieldFacts } = d
  const path = conferencePath(c.id)
  const upcoming = hasUpcomingDates(c)
  // Named keynotes and speakers only, as the event publishes them; panelists and moderators stay on the page without structured data.
  const performers = speakers.filter((p) => p.kind === 'KEYNOTE' || p.kind === 'SPEAKER').slice(0, 10)
  const exact = c.industries.length > 0 ? c.industries.join(', ') : 'every industry'
  const speakingLine = SPEAKING_LABEL[c.speaking as Speaking] ?? SPEAKING_LABEL.UNKNOWN
  const event = upcoming
    ? {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: c.name,
        startDate: c.startDate!.toISOString().slice(0, 10),
        ...(c.endDate ? { endDate: c.endDate.toISOString().slice(0, 10) } : {}),
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: c.format === 'VIRTUAL' ? 'https://schema.org/OnlineEventAttendanceMode' : c.format === 'HYBRID' ? 'https://schema.org/MixedEventAttendanceMode' : 'https://schema.org/OfflineEventAttendanceMode',
        location: c.format === 'VIRTUAL' ? { '@type': 'VirtualLocation', url: c.url ?? `${SITE_URL}${path}` } : { '@type': 'Place', name: [c.city, c.state].filter(Boolean).join(', ') || c.name, address: { '@type': 'PostalAddress', ...(c.city ? { addressLocality: c.city } : {}), ...(c.state ? { addressRegion: c.state } : {}), addressCountry: c.country } },
        description: c.whyAttend ?? `${c.name}, a ${KIND_LABEL[c.kind as keyof typeof KIND_LABEL]?.toLowerCase() ?? 'conference'} for ${exact}.`,
        url: `${SITE_URL}${path}`,
        ...(performers.length > 0 ? { performer: performers.map((p) => ({ '@type': 'Person', name: p.name, ...(p.title ? { jobTitle: p.title } : {}), ...(p.organization ? { worksFor: { '@type': 'Organization', name: p.organization } } : {}) })) } : {}),
        ...(c.organizer ? { organizer: { '@type': 'Organization', name: c.organizer, ...(c.url ? { url: c.url } : {}) } } : {}),
        ...(c.access === 'FREE' ? { isAccessibleForFree: true } : c.costLow != null ? { offers: { '@type': 'Offer', price: c.costLow, priceCurrency: 'USD', ...(c.url ? { url: c.url } : {}), availability: 'https://schema.org/InStock' } } : {}),
      }
    : null
  const trail = [{ name: 'Conferences', path: '/conferences' }, { name: c.name, path }]
  const industryItems = c.industries.map((n) => industryChip(n))
  const functionItems = effectiveFunctions(c).map((n) => functionChip(n))
  const employerSlugs = d.employerSlugs
  const employerSources = [...new Set(employers.map((e) => e.sourceUrl).filter((u): u is string => !!u && /^https:\/\//.test(u)))].slice(0, 4)
  const speakerSources = [...new Set(speakers.map((p) => p.sourceUrl).filter((u) => /^https:\/\//.test(u)))].slice(0, 4)
  const hiringIndustryNote = primaryIndustry ? `${primaryIndustry} employers` : 'Employers'

  return (
    <TopicShell
      trail={trail}
      title={c.name}
      intro={c.whyAttend ?? `${KIND_LABEL[c.kind as keyof typeof KIND_LABEL] ?? 'Conference'} for ${exact}.`}
      jsonLd={event ? [event] : undefined}
    >
      <dl className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Fact label="Dates">{whenLabel(c)}</Fact>
        <Fact label="Where">{whereLabel(c) || FORMAT_LABEL[c.format as keyof typeof FORMAT_LABEL]}{c.format !== 'IN_PERSON' && whereLabel(c) !== FORMAT_LABEL.VIRTUAL ? ` · ${FORMAT_LABEL[c.format as keyof typeof FORMAT_LABEL]}` : ''}</Fact>
        <Fact label="Cost">{costLabel(c)}</Fact>
        <Fact label="Type">{KIND_LABEL[c.kind as keyof typeof KIND_LABEL] ?? c.kind} · {ACCESS_LABEL[c.access as keyof typeof ACCESS_LABEL] ?? c.access}</Fact>
        {c.organizer && (
          <Fact label="Organizer">
            {association ? <Link href={associationPath(c.organizer)} className={LINK}>{c.organizer}</Link> : c.organizer}
          </Fact>
        )}
        {c.seniorities.length > 0 && <Fact label="Audience level">{c.seniorities.map((s) => SENIORITY_LABEL[s as Seniority] ?? s).join(', ')}</Fact>}
        {c.programFormats.length > 0 && <Fact label="Program">{c.programFormats.map((p) => PROGRAM_LABEL[p as keyof typeof PROGRAM_LABEL] ?? p).join(', ')}</Fact>}
        {c.journeys.length > 0 && <Fact label="Suits">{c.journeys.map((j) => JOURNEY_LABEL[j as keyof typeof JOURNEY_LABEL] ?? j).join(', ')}</Fact>}
        {c.verified && c.checkedAt && <Fact label="Last checked">{day(c.checkedAt)} against the event’s own site</Fact>}
      </dl>
      {c.url && c.linkStatus !== 'BROKEN' && (
        <p className="mt-5">
          <TrackedLink href={c.url} event="conference_site_clicked" properties={{ conferenceId: c.id, source: 'conference_page' }} className="inline-flex items-center rounded-lg bg-action px-5 py-3 text-sm font-semibold text-action-foreground hover:brightness-95">
            Official site and registration
          </TrackedLink>
        </p>
      )}
      {c.cheaperWays && <p className="mt-4 max-w-3xl text-sm text-muted-foreground"><span className="font-medium text-foreground">Cheaper ways in:</span> {c.cheaperWays}</p>}

      <section aria-labelledby="speaking" className="mt-12">
        <h2 id="speaking" className={H2}>Speaking opportunities</h2>
        <p className="mt-2 text-sm text-navy">{speakingLine}{c.speakingDeadline ? ` · deadline ${day(c.speakingDeadline)}` : ''}</p>
        {c.speakingNote && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{c.speakingNote}</p>}
        {c.speakingUrl && (
          <p className="mt-2"><TrackedLink href={c.speakingUrl} event="conference_speaking_clicked" properties={{ conferenceId: c.id }} className={LINK}>How to apply to speak</TrackedLink></p>
        )}
        {opportunities.length > 0 && (
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-white">
            {opportunities.map((o) => (
              <li key={o.id} className="px-5 py-3 text-sm">
                <p className="font-medium text-navy">
                  {o.url ? <TrackedLink href={o.url} event="conference_opportunity_clicked" properties={{ conferenceId: c.id, opportunityId: o.id, type: o.type }} className="hover:underline">{o.title}</TrackedLink> : o.title}
                </p>
                <p className="text-muted-foreground">{(OPPORTUNITY_LABEL as Record<string, string>)[o.type] ?? o.type}{o.deadline ? ` · deadline ${day(o.deadline)}` : ''}{o.eligibility ? ` · ${o.eligibility}` : ''}</p>
                {o.notes && <p className="mt-1 text-muted-foreground">{o.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {(c.roles.length > 0 || c.segments.length > 0 || c.seniorities.length > 0) && (
        <Section id="audience" title="Who goes" note="Roles and segments the organizer or our research tag this event for.">
          {c.segments.length > 0 && <p className="text-sm text-navy"><span className="font-medium">Segments:</span> {c.segments.join(', ')}</p>}
          {c.roles.length > 0 && <p className="mt-2 text-sm text-navy"><span className="font-medium">Roles:</span> {c.roles.join(', ')}</p>}
          {c.seniorities.length > 0 && <p className="mt-2 text-sm text-navy"><span className="font-medium">Levels:</span> {c.seniorities.map((x) => SENIORITY_LABEL[x as Seniority] ?? x).join(', ')}</p>}
        </Section>
      )}

      {primaryIndustry && fieldFacts.length > 0 && (
        <Section id="field" title={`The field it serves: ${primaryIndustry}`}>
          <FactGrid facts={fieldFacts} />
          <p className="mt-3 text-sm"><Link href={industryPath(primaryIndustry)} className={LINK}>Full {primaryIndustry} snapshot: jobs, pay, layoffs and conferences</Link></p>
        </Section>
      )}

      <Section id="employers" title={employers.length > 0 ? 'Employers at this conference' : `${hiringIndustryNote} hiring now`} note={employers.length > 0 ? 'Exhibitors, sponsors and speakers we have found on the event’s own lists.' : 'We have not yet published an exhibitor or attendee list for this event. These employers in its industry have open verified jobs, so they are the ones worth meeting.'}>
        {employers.length > 0 ? (
          <>
          <ul className="flex flex-wrap gap-2">
            {employers.map((e) => (
              <li key={`${e.name}:${e.role}`} className="rounded-full border border-border bg-white px-3 py-1.5 text-sm text-navy">
                {employerSlugs.get(normalizeOrgName(e.name)) ? <Link href={`/employers/${employerSlugs.get(normalizeOrgName(e.name))}`} className="underline underline-offset-2">{e.name}</Link> : e.name}{' '}
                <span className="text-xs text-muted-foreground">{ROLE_LABEL[e.role] ?? e.role}{e.year ? ` ${e.year}` : ''}</span>
              </li>
            ))}
          </ul>
          {employerSources.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">Read from the event’s own pages: {employerSources.map((u, i) => <span key={u}>{i > 0 && ', '}<a href={u} rel="nofollow noopener noreferrer" target="_blank" className="underline underline-offset-2">{new URL(u).hostname}</a></span>)}.</p>
          )}
          </>
        ) : jobs.employers.length > 0 ? (
          <Chips kind="conference_to_employer" event="topic_link_clicked" items={jobs.employers.map((e) => ({ href: `/employers/${e.slug}`, label: e.name, detail: `${e.count.toLocaleString()} open` }))} />
        ) : (
          <p className="text-sm text-muted-foreground">No employer list yet.</p>
        )}
      </Section>

      {speakers.length > 0 && (
        <Section id="speakers" title="Speakers and sessions" note="Named on the event’s own program. Titles and organizations are as the event lists them.">
          {(['KEYNOTE', 'MODERATOR', 'PANELIST', 'SPEAKER'] as const).map((kind) => {
            const group = speakers.filter((p) => p.kind === kind)
            if (group.length === 0) return null
            return (
              <div key={kind} className="mt-4 first:mt-0">
                <h3 className="text-sm font-semibold text-navy">{SPEAKER_GROUP[kind]}</h3>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {group.map((p) => (
                    <li key={`${p.name}:${p.kind}`} className="rounded-xl border border-border bg-white p-3 text-sm">
                      <p className="font-medium text-navy">{p.name}</p>
                      {(p.title || p.organization) && (
                        <p className="text-muted-foreground">
                          {p.title}{p.title && p.organization ? ', ' : ''}
                          {p.organization && (employerSlugs.get(normalizeOrgName(p.organization))
                            ? <Link href={`/employers/${employerSlugs.get(normalizeOrgName(p.organization))}`} className="underline underline-offset-2">{p.organization}</Link>
                            : p.organization)}
                        </p>
                      )}
                      {p.sessionTitle && <p className="mt-1 text-foreground">{p.sessionTitle}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
          {speakerSources.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">Read from the event’s own pages: {speakerSources.map((u, i) => <span key={u}>{i > 0 && ', '}<a href={u} rel="nofollow noopener noreferrer" target="_blank" className="underline underline-offset-2">{new URL(u).hostname.replace(/^www\./, '')}</a></span>)}</p>
          )}
        </Section>
      )}

      {(industryItems.length > 0 || functionItems.length > 0) && (
        <Section id="topics" title="Industries and functions">
          {industryItems.length > 0 && <Chips kind="conference_to_industry" event="topic_link_clicked" items={industryItems} />}
          {functionItems.length > 0 && <div className="mt-3"><Chips kind="conference_to_function" event="topic_link_clicked" items={functionItems} /></div>}
        </Section>
      )}


      {editions.length > 0 && (
        <Section id="editions" title="Past and planned editions">
          <ul className="space-y-1 text-sm text-navy">
            {editions.map((e) => (
              <li key={e.year}>{e.year}: {e.startDate ? `${day(e.startDate)}${e.endDate && e.endDate.getTime() !== e.startDate.getTime() ? ` to ${day(e.endDate)}` : ''}` : 'dates not announced'}{[e.city, e.state].filter(Boolean).length ? `, ${[e.city, e.state].filter(Boolean).join(', ')}` : ''}</li>
            ))}
          </ul>
        </Section>
      )}

      {association && organizerConfs.length > 0 && (
        <Section id="organizer" title={`More from ${c.organizer}`}>
          <ConferenceList rows={organizerConfs} total={organizerConfs.length} source={`conference:${c.id}:organizer`} />
          <p className="mt-3 text-sm"><Link href={associationPath(c.organizer!)} className={LINK}>All {association.count} {c.organizer} conferences</Link></p>
        </Section>
      )}

      {related.length > 0 && (
        <Section id="related" title="Related conferences">
          <ConferenceList rows={related} total={related.length} source={`conference:${c.id}`} />
        </Section>
      )}
      <JoinBand source={`conference:${c.id}`} what="the industries this event serves" />
    </TopicShell>
  )
}
